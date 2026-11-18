"use client";

import { createApiClient } from "@tartan/api-client";
import {
  clarifyPlannerProposalInput,
  confirmPlannerProposalInput,
  type ClarifyPlannerProposalInput,
  type PlannerProposalResponse,
  type PlannerReviewedDraft,
} from "@tartan/contracts";
import {
  PLANNER_MAX_ADJUSTMENTS,
  PLANNER_MAX_CLARIFICATIONS,
  phasePlanningKey,
  plannerDisplayText,
  type PhasePlanningReadiness,
} from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { PlannerExerciseResolution } from "./planner-exercise-resolution";
import { PlannerProgress } from "./planner-progress";
import type { PlannerContext } from "./planner-request";
import { PlannerDraftReview, type PlannerDraftWarning } from "./planner-review";
import type { PlannerStreamState } from "./use-planner-stream";

const api = createApiClient({ baseUrl: "" });
const t = w.planner;
const old = m.aiPlanner;

/** Le web relit toujours la séance dans l'éditeur de séquence du constructeur : chaque bloc reçoit sa séquence. */
const asSequence = (session: PlannerReviewedDraft): PlannerReviewedDraft => ({
  ...session,
  draft: {
    ...session.draft,
    structureVersion: 2,
    blocks: session.draft.blocks.map((block) => ({
      ...block,
      sequence: block.sequence ?? block.items.map((item) => ({ kind: "exercise" as const, itemRef: item.ref! })),
    })),
  },
});
const hasPercent = (session: PlannerReviewedDraft) =>
  session.draft.blocks.some((block) =>
    block.items.some((item) =>
      [item.prescription, item.autonomous?.prescription].some(
        (p) => p?.load?.type === "pct_1rm" || p?.setPlan?.some((set) => set.load?.type === "pct_1rm"),
      ),
    ),
  );

export function PlannerResult({
  orgId,
  context,
  proposal,
  stream,
  onClarify,
  onProposal,
  onRestart,
  onError,
}: {
  orgId: string;
  context: PlannerContext;
  proposal: PlannerProposalResponse;
  stream: PlannerStreamState;
  onClarify: (input: ClarifyPlannerProposalInput) => void;
  onProposal: (proposal: PlannerProposalResponse) => void;
  onRestart: () => void;
  onError: (message: string) => void;
}) {
  const [reply, setReply] = useState("");
  // Les brouillons d'une version : un ajustement en apporte de nouveaux, les anciens ne s'affichent plus.
  const [prepared, setPrepared] = useState<{ version: number; sessions: PlannerReviewedDraft[] } | null>(null);
  const drafts = prepared?.version === proposal.version ? prepared.sessions : null;

  const [warnings, setWarnings] = useState<PlannerDraftWarning[][]>([]);
  const [phases, setPhases] = useState<Record<number, PhasePlanningReadiness>>({});
  const [loads, setLoads] = useState<Record<number, { key: string; ready: boolean }>>({});
  const [created, setCreated] = useState(proposal.draftIds);
  const [busy, setBusy] = useState(false);
  const pendingConfirmation = useRef<ReturnType<typeof confirmPlannerProposalInput.parse> | null>(null);
  const display = (value: string) => plannerDisplayText(value, proposal);
  const running = stream.running || busy;

  // Une proposition arrive : ses brouillons se préparent tout de suite, sans clic de plus.
  useEffect(() => {
    if (proposal.state !== "proposal") return;
    const controller = new AbortController();
    void api
      .preparePlannerDrafts(orgId, proposal.id, proposal.version, controller.signal)
      .then((result) => {
        setPrepared({ version: result.version, sessions: result.sessions.map(asSequence) });
        setWarnings(result.warnings ?? []);
        setPhases({});
        setLoads({});
        pendingConfirmation.current = null;
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) onError(cause instanceof Error ? cause.message : m.common.genericError);
      });
    return () => controller.abort();
  }, [orgId, proposal.id, proposal.version, proposal.state, onError]);

  const updateDraft = useCallback((index: number, update: (draft: PlannerReviewedDraft) => PlannerReviewedDraft) => {
    setPrepared((current) => {
      const session = current?.sessions[index];
      if (!current || !session) return current;
      const next = update(session);
      return next === session
        ? current
        : { ...current, sessions: current.sessions.map((s, i) => (i === index ? next : s)) };
    });
    pendingConfirmation.current = null;
  }, []);
  const acceptPhase = useCallback(
    (index: number, state: PhasePlanningReadiness) =>
      setPhases((current) =>
        JSON.stringify(current[index]) === JSON.stringify(state) ? current : { ...current, [index]: state },
      ),
    [],
  );
  const acceptLoads = useCallback(
    (index: number, key: string, ready: boolean) =>
      setLoads((current) =>
        current[index]?.key === key && current[index]?.ready === ready
          ? current
          : { ...current, [index]: { key, ready } },
      ),
    [],
  );
  const phasesReady =
    !context.phasesEnabled ||
    Boolean(
      drafts?.every(
        (draft, index) =>
          phases[index]?.ready &&
          phases[index]?.key ===
            phasePlanningKey(
              draft.date,
              draft.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId),
              draft.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId),
            ),
      ),
    );
  // L'aperçu individuel n'est exigé que si un pourcentage doit être converti pour chacun.
  const loadsReady = Boolean(
    drafts?.every(
      (draft, index) => !hasPercent(draft) || (loads[index]?.ready && loads[index]?.key === JSON.stringify(draft)),
    ),
  );
  const valid =
    drafts &&
    confirmPlannerProposalInput.safeParse({ expectedVersion: proposal.version, sessions: drafts, confirmed: true })
      .success;

  const confirm = async () => {
    if (!drafts || !valid || !phasesReady || !loadsReady || running) return;
    setBusy(true);
    try {
      const input =
        pendingConfirmation.current ??
        confirmPlannerProposalInput.parse({ expectedVersion: proposal.version, sessions: drafts, confirmed: true });
      pendingConfirmation.current = input;
      const result = await api.confirmPlannerProposal(orgId, proposal.id, input);
      setCreated(result.sessions);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : m.common.genericError);
    } finally {
      setBusy(false);
    }
  };
  const send = () => {
    const input = clarifyPlannerProposalInput.safeParse({
      operationId: crypto.randomUUID(),
      expectedVersion: proposal.version,
      text: reply,
      reviewed: true,
    });
    if (!input.success || running) return;
    onClarify(input.data);
    setReply("");
  };

  const targets = proposal.targets.map((target) => target.label).join(", ");
  const period =
    proposal.selection.period.from === proposal.selection.period.to
      ? historyDate(proposal.selection.period.from)
      : `${historyDate(proposal.selection.period.from)} – ${historyDate(proposal.selection.period.to)}`;
  const adjustments = proposal.adjustmentCount ?? 0;

  if (created)
    return (
      <section className="flex flex-col gap-3">
        <p role="status">{t.created}</p>
        {created.map((session, index) => (
          <Button key={session.id} asChild variant="secondary">
            <Link href={`/seances/${session.id}`}>
              {t.openDraft(drafts?.[index]?.draft.title ?? old.createdDraft(index + 1))}
            </Link>
          </Button>
        ))}
        <Button asChild>
          <Link href="/calendrier">{m.nav.calendrier}</Link>
        </Button>
        <Button type="button" variant="quiet" onClick={onRestart}>
          {t.again}
        </Button>
      </section>
    );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section aria-label={t.stages.request} className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold break-words">{period}</p>
        <p className="text-soft break-words">{targets}</p>
        <details>
          <summary className="min-h-11 cursor-pointer py-2 text-soft">
            {proposal.selection.mode === "propose" ? t.modes.propose.title : t.modes.format.title}
          </summary>
          {proposal.messages.map((message, i) => (
            <p key={i} className="whitespace-pre-wrap break-words">
              {display(message)}
            </p>
          ))}
        </details>
      </section>

      {/* Les étapes et le plan restent visibles jusqu'à ce que la séance complète les remplace. */}
      {stream.running || (stream.steps.length && !drafts && proposal.state === "proposal") ? (
        <PlannerProgress state={stream} />
      ) : null}

      {proposal.state === "processing" && !stream.running ? (
        <div className="flex flex-col gap-3">
          <p role="status">{old.processing}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void api
                .plannerProposal(orgId, proposal.id)
                .then(onProposal)
                .catch((cause: unknown) => onError(cause instanceof Error ? cause.message : m.common.genericError));
            }}
          >
            {old.refresh}
          </Button>
        </div>
      ) : null}

      {proposal.state === "failed" && !stream.running ? (
        <p role="alert">{proposal.failure?.message ?? old.proposalFailed}</p>
      ) : null}

      {proposal.state === "clarification" && !stream.running ? (
        <section className="flex min-w-0 flex-col gap-4">
          <h2 className="t-section">{t.questions}</h2>
          {proposal.interpretation?.questions.map((q) => (
            <div key={`${proposal.clarificationCount}-${q.id}`} className="flex flex-col gap-2">
              <p className="font-semibold break-words">{display(q.question)}</p>
              {q.field === "exercise" ? (
                <PlannerExerciseResolution
                  questionId={q.id}
                  requestedName={q.exerciseName}
                  version={proposal.version}
                  exercises={
                    proposal.selection.mode === "propose"
                      ? context.exercises.filter((exercise) => exercise.guide?.technicalReview === "approved")
                      : context.exercises
                  }
                  allowCreate={proposal.selection.mode !== "propose"}
                  disabled={running}
                  resolved={proposal.exerciseResolutions?.find((entry) => entry.questionId === q.id)?.name}
                  onResolve={async (input) => {
                    const updated = await api.resolvePlannerExercise(orgId, proposal.id, input);
                    onProposal(updated);
                  }}
                />
              ) : null}
              {q.options.length ? (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((option, i) => (
                    <Button
                      key={i}
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={running}
                      onClick={() => setReply((text) => `${text}${text ? "\n" : ""}${display(option)}`)}
                    >
                      {display(option)}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {proposal.clarificationCount < PLANNER_MAX_CLARIFICATIONS ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <Field label={t.answer} hint={t.answerHint}>
                {(a) => <Textarea {...a} value={reply} disabled={running} onChange={(e) => setReply(e.target.value)} />}
              </Field>
              <Button type="submit" disabled={running || !reply.trim() || reply.length > 12000}>
                {t.sendAnswer}
              </Button>
            </form>
          ) : (
            <p>{old.clarificationLimit}</p>
          )}
        </section>
      ) : null}

      {proposal.state === "proposal" ? (
        <section className="flex min-w-0 flex-col gap-4" aria-busy={!drafts}>
          <div>
            <h2 className="t-section">{t.sessionTitle}</h2>
            <p className="t-caption text-soft">{t.sessionHint}</p>
          </div>
          {proposal.interpretation?.assumptions.length ? (
            <ul className="list-disc pl-5 text-soft">
              {proposal.interpretation.assumptions.map((line, i) => (
                <li key={i}>{display(line)}</li>
              ))}
            </ul>
          ) : null}
          {!drafts ? <p role="status">{m.common.loading}</p> : null}
          {drafts?.map((session, index) => (
            <PlannerDraftReview
              key={`${proposal.version}-${index}`}
              index={index}
              session={session}
              context={context}
              proposal={proposal}
              orgId={orgId}
              busy={running}
              warnings={warnings[index] ?? []}
              onUpdate={updateDraft}
              onPhaseReady={acceptPhase}
              onLoadsReady={acceptLoads}
            />
          ))}
          {drafts ? (
            <details className="rounded-card border border-card-line px-3">
              <summary className="min-h-11 cursor-pointer py-3 font-semibold">
                {t.adjust} · {t.adjustCount(adjustments, PLANNER_MAX_ADJUSTMENTS)}
              </summary>
              {adjustments < PLANNER_MAX_ADJUSTMENTS ? (
                <form
                  className="flex flex-col gap-3 pb-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    send();
                  }}
                >
                  <Field label={t.adjustLabel} hint={t.adjustHint}>
                    {(a) => (
                      <Textarea
                        {...a}
                        rows={2}
                        value={reply}
                        disabled={running}
                        onChange={(e) => setReply(e.target.value)}
                      />
                    )}
                  </Field>
                  <Button type="submit" variant="secondary" disabled={running || !reply.trim()}>
                    {t.adjustSend}
                  </Button>
                </form>
              ) : (
                <p className="pb-3">{t.adjustLimit}</p>
              )}
            </details>
          ) : null}
          {drafts && !loadsReady ? <p role="status">{t.loadsFirst}</p> : null}
          {drafts && !valid ? <p role="status">{old.draftsInvalid}</p> : null}
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-card-line bg-card px-4 py-3 desktop:static desktop:mx-0 desktop:border-0 desktop:p-0">
            <Button
              type="button"
              className="w-full tablet:w-auto"
              disabled={!drafts || !valid || !phasesReady || !loadsReady || running}
              onClick={() => void confirm()}
            >
              {busy ? t.creating : drafts && drafts.length > 1 ? t.createMany(drafts.length) : t.create}
            </Button>
            <p className="t-caption mt-2 text-soft">{old.noPublication}</p>
          </div>
        </section>
      ) : null}

      {!running ? (
        <Button type="button" variant="quiet" onClick={onRestart}>
          {t.edit}
        </Button>
      ) : null}
    </div>
  );
}
