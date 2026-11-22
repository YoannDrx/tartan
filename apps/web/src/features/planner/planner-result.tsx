"use client";

import { ApiError, createApiClient } from "@tartan/api-client";
import {
  clarifyPlannerProposalInput,
  confirmPlannerProposalInput,
  plannerReviewedDraft,
  type ClarifyPlannerProposalInput,
  type PlannerProposalResponse,
  type PlannerReviewedDraft,
} from "@tartan/contracts";
import {
  PLANNER_MAX_ADJUSTMENTS,
  PLANNER_MAX_CLARIFICATIONS,
  plannerDisplayText,
  replacedExercisePrescription,
  sessionExerciseReferences,
} from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TrackLine } from "@/components/track";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { PlannerProgress } from "./planner-progress";
import { Fold, type PlannerContext } from "./planner-request";
import {
  PlannerDraftReview,
  plannerSlotAnchor,
  type PlannerDraftSlot,
  type PlannerDraftWarning,
} from "./planner-review";
import type { PlannerStreamState } from "./use-planner-stream";

const api = createApiClient({ baseUrl: "" });
const t = w.planner;

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
const messageOf = (cause: unknown) => (cause instanceof ApiError ? cause.message : m.common.genericError);
/** Une fiche prend la place d'un exercice de l'écran : sa prescription reste, ses charges adaptées par athlète partent. */
const withExercise = (sessions: PlannerReviewedDraft[], ref: string, exerciseId: string): PlannerReviewedDraft[] =>
  sessions.map((session) =>
    session.draft.blocks.some((block) => block.items.some((item) => item.ref === ref))
      ? {
          ...session,
          overrides: session.overrides.filter(
            (o) => sessionExerciseReferences(session.draft).get(o.itemRef)?.ref !== ref,
          ),
          draft: {
            ...session.draft,
            blocks: session.draft.blocks.map((block) => ({
              ...block,
              items: block.items.map((item) =>
                item.ref === ref && item.exerciseId !== exerciseId
                  ? { ...item, exerciseId, prescription: replacedExercisePrescription(item.prescription, exerciseId) }
                  : item,
              ),
            })),
          },
        }
      : session,
  );

/**
 * La séance : ce que le planificateur a compris, puis la séance dans l'éditeur du constructeur. Un exercice dont la
 * fiche est à vérifier ou manque se tranche dans la séance, sans réponse écrite ni relance ; une seule action crée
 * le brouillon, et dit ce qui reste à compléter tant qu'il en reste.
 */
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
  // La séance à l'écran, avec la version de la proposition qu'elle reflète. Un ajustement ou le retrait d'un
  // emplacement en apporte une nouvelle ; d'ici là, l'ancienne reste affichée, figée.
  const [prepared, setPrepared] = useState<{ version: number; sessions: PlannerReviewedDraft[] } | null>(null);
  const [warnings, setWarnings] = useState<PlannerDraftWarning[][]>([]);
  const [slots, setSlots] = useState<PlannerDraftSlot[]>([]);
  const [loads, setLoads] = useState<Record<number, { key: string; ready: boolean }>>({});
  const [created, setCreated] = useState(proposal.draftIds);
  const [busy, setBusy] = useState(false);
  const pendingConfirmation = useRef<ReturnType<typeof confirmPlannerProposalInput.parse> | null>(null);
  const display = (value: string) => plannerDisplayText(value, proposal);
  const drafts = prepared?.sessions ?? null;
  const stale = Boolean(prepared && prepared.version !== proposal.version);
  const running = stream.running || busy || stale;

  // Une proposition arrive, ou change sur le serveur : sa séance se prépare tout de suite, sans clic de plus.
  // Quand l'écran a déjà appliqué le changement lui-même (une fiche choisie), il porte déjà cette version.
  const preparedVersion = prepared?.version;
  useEffect(() => {
    if (proposal.state !== "proposal" || preparedVersion === proposal.version) return;
    const controller = new AbortController();
    void api
      .preparePlannerDrafts(orgId, proposal.id, proposal.version, controller.signal)
      .then((result) => {
        setPrepared({ version: result.version, sessions: result.sessions.map(asSequence) });
        setWarnings(result.warnings ?? []);
        setSlots(result.slots ?? []);
        setLoads({});
        pendingConfirmation.current = null;
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) onError(messageOf(cause));
      });
    return () => controller.abort();
  }, [orgId, proposal.id, proposal.version, proposal.state, preparedVersion, onError]);

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
  const acceptLoads = useCallback(
    (index: number, key: string, ready: boolean) =>
      setLoads((current) =>
        current[index]?.key === key && current[index]?.ready === ready
          ? current
          : { ...current, [index]: { key, ready } },
      ),
    [],
  );
  // La phase vient avec la séance préparée ; elle n'est redemandée que si le coach change la date ou les
  // destinataires, dans la séance.
  const phasesReady = !context.phasesEnabled || Boolean(drafts?.every((draft) => draft.phaseReview));
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
  // La séance de l'écran, quand elle peut partir telle quelle : c'est la base d'un ajustement ou d'un retrait.
  const screen = drafts && plannerReviewedDraft.array().min(1).safeParse(drafts).success ? drafts : undefined;

  const confirm = async () => {
    if (!drafts || !valid || !phasesReady || !loadsReady || running || slots.length) return;
    setBusy(true);
    try {
      const input =
        pendingConfirmation.current ??
        confirmPlannerProposalInput.parse({ expectedVersion: proposal.version, sessions: drafts, confirmed: true });
      pendingConfirmation.current = input;
      const result = await api.confirmPlannerProposal(orgId, proposal.id, input);
      setCreated(result.sessions);
    } catch (cause) {
      onError(messageOf(cause));
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
      // « Ajuster » part de la séance à l'écran : les retouches faites à la main sont gardées.
      ...(proposal.state === "proposal" && screen ? { sessions: screen } : {}),
    });
    if (!input.success || running) return;
    onClarify(input.data);
    setReply("");
  };
  // Une fiche choisie dans la séance : le serveur la pose à la même place et retient le terme ; l'écran fait de
  // même sur place, sans rien recharger ni perdre.
  const settle = async (
    questionId: string,
    said: string,
    itemRef: string,
    exercise: { id: string; name: string },
    done: () => void,
  ) => {
    if (running || !prepared) return;
    setBusy(true);
    try {
      const updated = await api.resolvePlannerExercise(orgId, proposal.id, {
        operationId: crypto.randomUUID(),
        expectedVersion: proposal.version,
        questionId,
        requestedName: said,
        choice: { kind: "existing", exerciseId: exercise.id },
      });
      setPrepared((current) =>
        current ? { version: updated.version, sessions: withExercise(current.sessions, itemRef, exercise.id) } : current,
      );
      pendingConfirmation.current = null;
      done();
      onProposal(updated);
    } catch (cause) {
      toast.error(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };
  const resolveSlot = async (
    slot: PlannerDraftSlot,
    choice: { kind: "use"; exercise: { id: string; name: string } } | { kind: "remove" },
  ) => {
    if (choice.kind === "use")
      return settle(slot.id, slot.said, slot.itemRef, choice.exercise, () => {
        setSlots((current) => current.filter((entry) => entry.id !== slot.id));
        toast.ok(t.slot.filled(slot.said, choice.exercise.name));
      });
    if (running) return;
    setBusy(true);
    try {
      // Le retrait déplace le reste de la séance : elle repart de l'écran, puis se prépare de nouveau.
      const updated = await api.resolvePlannerExercise(orgId, proposal.id, {
        operationId: crypto.randomUUID(),
        expectedVersion: proposal.version,
        questionId: slot.id,
        requestedName: slot.said,
        choice: { kind: "remove" },
        ...(screen ? { sessions: screen } : {}),
      });
      toast.ok(t.slot.removed(slot.said));
      onProposal(updated);
    } catch (cause) {
      toast.error(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };
  const resolveProbable = (warning: PlannerDraftWarning, exercise: { id: string; name: string }) => {
    const ref = warning.itemRef;
    if (!ref) return Promise.resolve();
    const said = warning.said ?? exercise.name;
    return settle(ref, said, ref, exercise, () => {
      setWarnings((current) =>
        current.map((list) =>
          list.filter((entry) => entry.itemRef !== ref || entry.code !== "approximate_exercise"),
        ),
      );
      toast.ok(t.probable.learned(said, exercise.name));
    });
  };

  const targets = proposal.targets
    .filter(
      (target) =>
        !drafts ||
        drafts.some((draft) =>
          draft.assignments.some((a) => a.targetType === target.type && a.targetId === target.id),
        ),
    )
    .map((target) => target.label)
    .join(", ");
  const period =
    proposal.selection.period.from === proposal.selection.period.to
      ? historyDate(proposal.selection.period.from)
      : `${historyDate(proposal.selection.period.from)} – ${historyDate(proposal.selection.period.to)}`;
  const adjustments = proposal.adjustmentCount ?? 0;
  const firstSlot = slots[0];

  if (created)
    return (
      <section className="flex flex-col items-start gap-3">
        <p role="status">{t.created}</p>
        {created.map((session, index) => (
          <Button key={session.id} asChild>
            <Link href={`/seances/${session.id}`}>
              {t.openDraft(drafts?.[index]?.draft.title ?? t.createdDraft(index + 1))}
            </Link>
          </Button>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/calendrier">{t.calendar}</Link>
          </Button>
          <Button type="button" variant="quiet" onClick={onRestart}>
            {t.again}
          </Button>
        </div>
      </section>
    );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section aria-label={t.stages.request} className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="break-words font-semibold">{period}</p>
          {targets ? <p className="break-words text-soft">{targets}</p> : null}
        </div>
        {/* Ce que le planificateur a compris de la demande, avant la séance : le coach sait s'il a été entendu. */}
        {proposal.understanding?.summary && !stream.running ? (
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 className="t-section">{t.understood}</h2>
            <p className="max-w-prose break-words">{proposal.understanding.summary}</p>
          </div>
        ) : null}
        <Fold bare title={t.request}>
          {proposal.messages.map((message, i) => (
            <p key={i} className="max-w-prose whitespace-pre-wrap break-words text-soft">
              {display(message)}
            </p>
          ))}
        </Fold>
      </section>

      {/* Les étapes et le plan restent visibles jusqu'à ce que la séance complète les remplace. */}
      {stream.running || (stream.steps.length && !drafts && proposal.state === "proposal") ? (
        <PlannerProgress state={stream} />
      ) : null}

      {proposal.state === "processing" && !stream.running ? (
        <div className="flex flex-col items-start gap-3">
          <p role="status">{t.processing}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void api
                .plannerProposal(orgId, proposal.id)
                .then(onProposal)
                .catch((cause: unknown) => onError(messageOf(cause)));
            }}
          >
            {t.refresh}
          </Button>
        </div>
      ) : null}

      {proposal.state === "failed" && !stream.running ? (
        <p role="alert" className="rounded-button border border-st-missed px-3 py-2">
          {proposal.failure?.step ? <span className="font-semibold">{t.failedAt(proposal.failure.step)} </span> : null}
          <span>{proposal.failure?.message ?? t.failed}</span>
        </p>
      ) : null}

      {proposal.state === "clarification" && !stream.running ? (
        <section className="flex min-w-0 flex-col gap-4">
          <h2 className="t-section">{t.questions}</h2>
          {proposal.interpretation?.questions.map((q) => (
            <div key={`${proposal.clarificationCount}-${q.id}`} className="flex flex-col gap-2">
              <p className="break-words font-semibold">{display(q.question)}</p>
              {q.field === "exercise" ? <p className="text-soft">{t.exerciseQuestion}</p> : null}
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
              className="flex flex-col items-start gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <Field label={t.answer} hint={t.answerHint} className="w-full">
                {(a) => <Textarea {...a} value={reply} disabled={running} onChange={(e) => setReply(e.target.value)} />}
              </Field>
              <Button type="submit" disabled={running || !reply.trim() || reply.length > 12000}>
                {t.sendAnswer}
              </Button>
            </form>
          ) : (
            <p>{t.questionLimit}</p>
          )}
        </section>
      ) : null}

      {proposal.state === "proposal" ? (
        <section className="flex min-w-0 flex-col gap-4" aria-busy={!drafts || stale}>
          <TrackLine />
          <div>
            <h2 className="t-section">{t.sessionTitle}</h2>
            <p className="t-caption font-normal text-soft">{t.sessionHint}</p>
          </div>
          {proposal.interpretation?.assumptions.length ? (
            <div className="flex min-w-0 flex-col gap-1">
              <p className="t-caption">{t.assumptions}</p>
              <ul className="list-disc pl-5 text-soft">
                {proposal.interpretation.assumptions.map((line, i) => (
                  <li key={i} className="break-words">
                    {display(line)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {!drafts ? <p role="status">{t.loadingSession}</p> : null}
          {drafts?.map((session, index) => (
            <PlannerDraftReview
              key={index}
              index={index}
              session={session}
              context={context}
              proposal={proposal}
              orgId={orgId}
              busy={running}
              warnings={warnings[index] ?? []}
              slots={slots.filter((slot) => slot.session === index)}
              onUpdate={updateDraft}
              onLoadsReady={acceptLoads}
              onSlot={resolveSlot}
              onProbable={resolveProbable}
            />
          ))}
          {drafts ? (
            <Fold title={t.adjust} detail={t.adjustCount(adjustments, PLANNER_MAX_ADJUSTMENTS)}>
              {adjustments < PLANNER_MAX_ADJUSTMENTS ? (
                <form
                  className="flex flex-col items-start gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    send();
                  }}
                >
                  <Field label={t.adjustLabel} hint={t.adjustHint} className="w-full">
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
                <p>{t.adjustLimit}</p>
              )}
            </Fold>
          ) : null}
          <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-card-line bg-card px-4 py-3 desktop:static desktop:mx-0 desktop:border-0 desktop:p-0">
            {/* Ce qui retient encore le brouillon, dit à côté du bouton. */}
            {drafts && firstSlot ? (
              <p role="status">{t.slot.left(slots.length)}</p>
            ) : drafts && !valid ? (
              <p role="status">{t.draftsInvalid}</p>
            ) : drafts && !loadsReady ? (
              <p role="status">{t.loads.needed}</p>
            ) : null}
            {firstSlot ? (
              // Tant qu'un exercice attend sa fiche, le bouton dit lequel et y mène.
              <Button
                type="button"
                className="w-full tablet:w-auto tablet:self-start"
                disabled={running}
                onClick={() => {
                  const card = document.getElementById(plannerSlotAnchor(firstSlot.id));
                  card?.scrollIntoView({ block: "center" });
                  card?.querySelector<HTMLButtonElement>("button[aria-label]")?.focus({ preventScroll: true });
                }}
              >
                {t.complete(slots.length, firstSlot.said)}
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full tablet:w-auto tablet:self-start"
                disabled={!drafts || !valid || !phasesReady || !loadsReady || running}
                onClick={() => void confirm()}
              >
                {busy ? t.creating : drafts && drafts.length > 1 ? t.createMany(drafts.length) : t.create}
              </Button>
            )}
            <p className="t-caption font-normal text-soft">{t.noPublication}</p>
          </div>
        </section>
      ) : null}

      {!running ? (
        <Button type="button" variant="quiet" className="self-start" onClick={onRestart}>
          {t.edit}
        </Button>
      ) : null}
    </div>
  );
}
