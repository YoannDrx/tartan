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
  plannerAgenda,
  PLANNER_MAX_ADJUSTMENTS,
  PLANNER_MAX_CLARIFICATIONS,
  plannerDisplayText,
  replacedExercisePrescription,
  sessionExerciseReferences,
} from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { TrackLine } from "@/components/track";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { usePlannerDictation } from "./web-dictation";
import { Dialog } from "@/components/ui/dialog";
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
  const router = useRouter();
  const duplicateIds = useRef(new Map<string, string>());
  const copyDraft = async (id: string, version: number) => {
    if (busy) return;
    setBusy(true);
    const key = id + version,
      op = duplicateIds.current.get(key) ?? crypto.randomUUID();
    duplicateIds.current.set(key, op);
    try {
      const copied = await api.duplicatePlannerDraft(orgId, id, op, version);
      router.push(`/seances/${copied.id}`);
    } catch (cause) {
      onError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };
  const [reply, setReply] = useState("");
  const [keep, setKeep] = useState<{ session: number; block: number }[]>([]);
  const isKept = (session: number, block: number) => keep.some((e) => e.session === session && e.block === block);
  const toggleKeep = (session: number, block: number) =>
    setKeep((old) =>
      old.some((e) => e.session === session && e.block === block)
        ? old.filter((e) => e.session !== session || e.block !== block)
        : [...old, { session, block }],
    );
  const decide = async (apply: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      onProposal(await api.decidePlannerAdjustment(orgId, proposal.id, proposal.version, apply));
      setKeep([]);
    } catch (cause) {
      onError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };
  const mic = usePlannerDictation(orgId, (text) => setReply((current) => [current, text].filter(Boolean).join(" ")));
  const [linked, setLinked] = useState(proposal.linkedSessions);
  const refreshLinked = async () => setLinked((await api.plannerProposal(orgId, proposal.id)).linkedSessions);
  // La séance à l'écran, avec la version de la proposition qu'elle reflète. Un ajustement ou le retrait d'un
  // emplacement en apporte une nouvelle ; d'ici là, l'ancienne reste affichée, figée.
  const [prepared, setPrepared] = useState<{
    version: number;
    sessions: PlannerReviewedDraft[];
    edited?: boolean;
  } | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveStopped, setSaveStopped] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [localCopy, setLocalCopy] = useState<PlannerReviewedDraft[] | null>(null);
  const saving = useRef(false);
  const [warnings, setWarnings] = useState<PlannerDraftWarning[][]>([]);
  const [slots, setSlots] = useState<PlannerDraftSlot[]>([]);
  const [loads, setLoads] = useState<Record<number, { key: string; ready: boolean }>>({});
  const [created, setCreated] = useState(proposal.draftIds);
  const [busy, setBusy] = useState(false);
  const pendingConfirmation = useRef<ReturnType<typeof confirmPlannerProposalInput.parse> | null>(null);
  const display = (value: string) => plannerDisplayText(value, proposal);
  const drafts = prepared?.sessions ?? null;
  const [skipped, setSkipped] = useState<number[]>([]);
  const complete = proposal.createdSessionIndices ?? [];
  const selected = (drafts ?? []).map((_, i) => i).filter((i) => !complete.includes(i) && !skipped.includes(i));
  const agenda =
    drafts && proposal.selection.period.from !== proposal.selection.period.to
      ? plannerAgenda(proposal, drafts, context.exercises)
      : [];
  const equipmentLabels = { ...m.trainingProfile.equipment, ...m.exerciseClassification.extraEquipment };
  const selectedSlots = slots.filter((slot) => selected.includes(slot.session));
  const toggleSession = (i: number) => {
    setSkipped((old) => (old.includes(i) ? old.filter((n) => n !== i) : [...old, i]));
    pendingConfirmation.current = null;
  };
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

  const updateDraft = useCallback(
    (index: number, update: (draft: PlannerReviewedDraft) => PlannerReviewedDraft) => {
      setSaveStopped(false);
      setSaveMessage("");
      setPrepared((current) => {
        const session = current?.sessions[index];
        if (!current || !session) return current;
        const next = update(session);
        return next === session
          ? current
          : { ...current, edited: true, sessions: current.sessions.map((s, i) => (i === index ? next : s)) };
      });
      pendingConfirmation.current = null;
    },
    [setPrepared, setSaveMessage, setSaveStopped],
  );
  const acceptLoads = useCallback(
    (index: number, key: string, ready: boolean) =>
      setLoads((current) =>
        current[index]?.key === key && current[index]?.ready === ready
          ? current
          : { ...current, [index]: { key, ready } },
      ),
    [setLoads],
  );
  // La phase vient avec la séance préparée ; elle n'est redemandée que si le coach change la date ou les
  // destinataires, dans la séance.
  const phasesReady =
    !context.phasesEnabled || Boolean(drafts?.every((draft, i) => !selected.includes(i) || draft.phaseReview));
  // L'aperçu individuel n'est exigé que si un pourcentage doit être converti pour chacun.
  const loadsReady = Boolean(
    drafts?.every(
      (draft, index) =>
        !selected.includes(index) ||
        !hasPercent(draft) ||
        (loads[index]?.ready && loads[index]?.key === JSON.stringify(draft)),
    ),
  );
  const valid =
    drafts &&
    confirmPlannerProposalInput.safeParse({ expectedVersion: proposal.version, sessions: drafts, confirmed: true })
      .success;
  // La séance de l'écran, quand elle peut partir telle quelle : c'est la base d'un ajustement ou d'un retrait.
  const screen = drafts && plannerReviewedDraft.array().min(1).safeParse(drafts).success ? drafts : undefined;

  const save = useCallback(async () => {
    if (!prepared?.edited || !valid || running || saving.current || created) return;
    saving.current = true;
    setBusy(true);
    try {
      const saved = await api.savePlannerReview(orgId, proposal.id, {
        expectedVersion: prepared.version,
        sessions: prepared.sessions,
      });
      setPrepared((current) =>
        current && current.version === prepared.version
          ? { ...current, version: saved.version, edited: current.sessions !== prepared.sessions }
          : current,
      );
      onProposal({ ...proposal, version: saved.version });
      setConflict(false);
      setLocalCopy(null);
      setSaveMessage(m.aiPlanner.savedReview);
    } catch (cause) {
      setSaveStopped(true);
      setConflict(cause instanceof ApiError && cause.code === "planner_proposal_conflict");
      onError(messageOf(cause));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }, [created, onError, onProposal, orgId, prepared, proposal, running, valid]);
  useEffect(() => {
    if (!prepared?.edited || !valid || running || saveStopped || created) return;
    const timer = setTimeout(() => void save(), 1000);
    return () => clearTimeout(timer);
  }, [created, prepared, running, save, saveStopped, valid]);

  const reloadReview = async () => {
    if (!prepared || busy) return;
    setBusy(true);
    try {
      const fresh = await api.plannerProposal(orgId, proposal.id);
      setLocalCopy(prepared.sessions);
      setConflict(false);
      setSaveMessage("");
      setPrepared(null);
      setCreated(fresh.draftIds);
      setLinked(fresh.linkedSessions);
      onProposal(fresh);
      onError("");
    } catch (cause) {
      onError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };
  const restoreReview = () => {
    if (!localCopy || !prepared) return;
    setPrepared({ ...prepared, sessions: localCopy, edited: true });
    setSaveStopped(true);
    setSaveMessage(m.aiPlanner.restoredReview);
    pendingConfirmation.current = null;
  };

  const confirm = async () => {
    if (!drafts || !valid || !phasesReady || !loadsReady || running || selectedSlots.length || !selected.length) return;
    setBusy(true);
    try {
      const input =
        pendingConfirmation.current ??
        confirmPlannerProposalInput.parse({
          expectedVersion: proposal.version,
          sessions: drafts,
          confirmed: true,
          ...(drafts.length > 1 ? { selectedIndices: selected } : {}),
        });
      pendingConfirmation.current = input;
      const result = await api.confirmPlannerProposal(orgId, proposal.id, input);
      const fresh = await api.plannerProposal(orgId, proposal.id);
      setLinked(fresh.linkedSessions);
      onProposal(fresh);
      pendingConfirmation.current = null;
      if (result.partial) {
        setSkipped([]);
        setSaveMessage(m.aiPlanner.remainingDays);
      } else setCreated(fresh.draftIds ?? result.sessions);
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
      ...(proposal.state === "proposal" ? { ...(screen ? { sessions: screen } : {}), adjustmentReview: { keep } } : {}),
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
        ...(screen ? { sessions: screen } : {}),
      });
      setPrepared((current) =>
        current
          ? { version: updated.version, sessions: withExercise(current.sessions, itemRef, exercise.id) }
          : current,
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
        current.map((list) => list.filter((entry) => entry.itemRef !== ref || entry.code !== "approximate_exercise")),
      );
      toast.ok(t.probable.learned(said, exercise.name));
    });
  };

  const targets = proposal.targets
    .filter(
      (target) =>
        !drafts ||
        drafts.some((draft) => draft.assignments.some((a) => a.targetType === target.type && a.targetId === target.id)),
    )
    .map((target) => target.label)
    .join(", ");
  const period =
    proposal.selection.period.from === proposal.selection.period.to
      ? historyDate(proposal.selection.period.from)
      : `${historyDate(proposal.selection.period.from)} – ${historyDate(proposal.selection.period.to)}`;
  const adjustments = proposal.adjustmentCount ?? 0;
  const firstSlot = selectedSlots[0];

  if (proposal.adjustmentPreview)
    return (
      <section className="flex flex-col gap-4" aria-label={m.aiPlanner.adjustmentReview}>
        <h2 className="t-section">{m.aiPlanner.adjustmentReview}</h2>
        {proposal.adjustmentPreview.length === 0 && <p>{m.aiPlanner.noAdjustments}</p>}
        {proposal.adjustmentPreview.map((pair, i) => (
          <div className="grid gap-4 tablet:grid-cols-2" key={i}>
            {(["before", "after"] as const).map((side) => (
              <div key={side}>
                <h3 className="font-semibold">{side === "before" ? m.aiPlanner.prior : m.aiPlanner.proposed}</h3>
                <ul>
                  {pair[side].map((line, j) => (
                    <li className="break-words" key={j}>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void decide(true)}>
            {m.aiPlanner.applyAdjustment}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void decide(false)}>
            {m.aiPlanner.discardAdjustment}
          </Button>
        </div>
      </section>
    );
  if (created)
    return (
      <section className="flex flex-col items-start gap-3">
        <p role="status">{t.created}</p>
        {created.map((session, index) => {
          const item = linked?.find((s) => s.id === session.id);
          if (item?.state === "unavailable") return <p key={session.id}>{m.aiPlanner.missingDraft}</p>;
          const name = item
            ? item.title + " · " + historyDate(item.date)
            : (drafts?.[index]?.draft.title ?? t.createdDraft(index + 1));
          return (
            <div key={session.id} className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/seances/${session.id}`}>
                  {item?.state === "published" ? m.aiPlanner.openPublished(name) : t.openDraft(name)}
                </Link>
              </Button>
              {item?.state === "draft" && (
                <Button variant="secondary" disabled={busy} onClick={() => void copyDraft(item.id, item.version)}>
                  {m.aiPlanner.duplicateDraft}
                </Button>
              )}
              {item?.state === "draft" ? (
                <Dialog
                  title={m.aiPlanner.removeDraft}
                  description={m.aiPlanner.removeDraftDetail(item.title, historyDate(item.date))}
                  trigger={<Button variant="quiet">{m.aiPlanner.removeDraft}</Button>}
                >
                  <Button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api.deleteSession(
                          orgId,
                          item.id,
                          { expectedVersion: item.version, expectedLogCount: 0 },
                          true,
                        );
                        await refreshLinked();
                      } catch (e) {
                        toast.error(messageOf(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {m.common.delete}
                  </Button>
                </Dialog>
              ) : null}
            </div>
          );
        })}
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
              <Button
                type="button"
                variant="secondary"
                disabled={!mic.recording && mic.busy}
                onClick={mic.recording ? mic.stop : mic.start}
              >
                {mic.recording ? t.dictation.stop : m.aiPlanner.dictateReply}
              </Button>
              {mic.canRecover ? (
                <Button type="button" onClick={mic.recover}>
                  {t.dictation.recover}
                </Button>
              ) : null}
              {mic.status || mic.error ? <p role="status">{mic.error || mic.status}</p> : null}
              <Button type="submit" disabled={running || mic.busy || !reply.trim() || reply.length > 12000}>
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
          {agenda.length > 0 && (
            <section aria-label={m.aiPlanner.agenda}>
              <h3 className="t-section">{m.aiPlanner.agenda}</h3>
              <ol className="divide-y divide-card-line">
                {agenda.map((day) => (
                  <li key={day.date} className="py-2">
                    <strong>{historyDate(day.date)}</strong>
                    {day.sessions.length === 0 && day.calendar.length === 0 && <p>{m.aiPlanner.restDay}</p>}
                    {day.calendar.map((entry) => (
                      <p key={entry.id}>
                        {m.aiPlanner.planned} · {entry.title}
                      </p>
                    ))}
                    {day.sessions.map((s, i) => (
                      <div key={i}>
                        <p>
                          {s.title} ·{" "}
                          {s.estimated ? m.aiPlanner.estimatedMinutes(s.estimated) : m.aiPlanner.unknownDuration}
                        </p>
                        <p>{s.blocks.join(" · ")}</p>
                        {s.equipment.length > 0 && <p>{s.equipment.map((e) => equipmentLabels[e]).join(", ")}</p>}
                        {s.missingRest && <p>{m.aiPlanner.missingRest}</p>}
                        {s.missingEquipment.length > 0 && (
                          <p>
                            {m.aiPlanner.equipmentCheck} ·{" "}
                            {s.missingEquipment.map((e) => equipmentLabels[e]).join(", ")}
                          </p>
                        )}
                        {s.consecutiveJumps && <p>{m.aiPlanner.consecutiveJumps}</p>}
                        {s.collision && <p>{m.aiPlanner.collision}</p>}
                      </div>
                    ))}
                  </li>
                ))}
              </ol>
            </section>
          )}
          {complete.length > 0 &&
            linked?.map((item) =>
              item.state === "unavailable" ? (
                <p key={item.id}>{m.aiPlanner.missingDraft}</p>
              ) : (
                <Link key={item.id} className="underline" href={`/seances/${item.id}`}>
                  {item.state === "published" ? m.aiPlanner.openPublished(item.title) : t.openDraft(item.title)} ·{" "}
                  {historyDate(item.date)}
                </Link>
              ),
            )}
          {drafts && drafts.length > 1 && (
            <fieldset className="flex flex-col gap-2">
              <legend>{m.aiPlanner.selectDays}</legend>
              {drafts.map((d, i) => (
                <label key={i} className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(i)}
                    disabled={running || complete.includes(i)}
                    onChange={() => toggleSession(i)}
                  />
                  {[historyDate(d.date), d.draft.title, complete.includes(i) ? m.aiPlanner.alreadyCreated : null]
                    .filter(Boolean)
                    .join(" · ")}
                </label>
              ))}
            </fieldset>
          )}
          {drafts?.map((session, index) => (
            <PlannerDraftReview
              key={index}
              index={index}
              session={session}
              context={context}
              proposal={proposal}
              orgId={orgId}
              busy={running || complete.includes(index)}
              warnings={warnings[index] ?? []}
              slots={slots.filter((slot) => slot.session === index)}
              onUpdate={updateDraft}
              onLoadsReady={acceptLoads}
              onSlot={resolveSlot}
              onProbable={resolveProbable}
            />
          ))}
          {drafts && !complete.length ? (
            <Fold title={t.adjust} detail={t.adjustCount(adjustments, PLANNER_MAX_ADJUSTMENTS)}>
              {adjustments < PLANNER_MAX_ADJUSTMENTS ? (
                <form
                  className="flex flex-col items-start gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    send();
                  }}
                >
                  <fieldset>
                    <legend>{m.aiPlanner.keepBlocks}</legend>
                    {drafts.map((d, session) =>
                      d.draft.blocks.map((b, block) => (
                        <label key={b.ref} className="flex min-h-11 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isKept(session, block)}
                            onChange={() => toggleKeep(session, block)}
                            disabled={running}
                          />
                          {[historyDate(d.date), b.name].join(" · ")}
                        </label>
                      )),
                    )}
                  </fieldset>
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
              <p role="status">{t.slot.left(selectedSlots.length)}</p>
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
                {t.complete(selectedSlots.length, firstSlot.said)}
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full tablet:w-auto tablet:self-start"
                disabled={!drafts || !valid || !phasesReady || !loadsReady || running || !selected.length}
                onClick={() => void confirm()}
              >
                {busy ? t.creating : selected.length > 1 ? t.createMany(selected.length) : t.create}
              </Button>
            )}
            {prepared?.edited ? (
              <Button variant="secondary" disabled={!valid || running} onClick={() => void save()}>
                {m.aiPlanner.saveReview}
              </Button>
            ) : null}
            {conflict ? (
              <Button variant="secondary" disabled={busy} onClick={() => void reloadReview()}>
                {m.aiPlanner.reloadReview}
              </Button>
            ) : null}
            {localCopy && !prepared?.edited ? (
              <Button variant="secondary" disabled={running} onClick={restoreReview}>
                {m.aiPlanner.restoreReview}
              </Button>
            ) : null}
            {saveMessage ? <p role="status">{saveMessage}</p> : null}
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
