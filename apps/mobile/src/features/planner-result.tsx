import { ApiError } from "@tartan/api-client";
import {
  confirmPlannerProposalInput,
  type ClarifyPlannerProposalInput,
  type ConfirmPlannerProposalInput,
  type ExerciseSummary,
  type PlannerProposalResponse,
  type PlannerReviewedDraft,
  type PlannerUsageResponse,
} from "@tartan/contracts";
import { PLANNER_MAX_ADJUSTMENTS, PLANNER_MAX_CLARIFICATIONS, plannerDisplayText } from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePlannerDictation } from "./planner-dictation";
import { Alert, AccessibilityInfo, View } from "react-native";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import {
  PLANNER_TEXT_LIMIT,
  plannerAsSequence,
  plannerClarifyInput,
  plannerNextAction,
  plannerScreenSessions,
  plannerWithExercise,
  type PlannerDraftSlot,
  type PlannerDraftWarning,
} from "../lib/planner-flow";
import type { PlannerStreamState } from "../lib/planner-stream";
import { Button, Field, SectionTitle, T } from "../ui/primitives";
import { StackScreen } from "../ui/screen";
import { space } from "../ui/theme";
import { PlannerDraftReview, type Picking } from "./planner-draft-review";
import { PlannerHeader } from "./planner-header";
import { NativePlannerProgress } from "./planner-progress";
import { Fold, Pill, PillRow } from "./planner-ui";

type Context = Awaited<ReturnType<typeof api.sessionBuilder>>;
type Picked = { id: string; name: string };
const t = m.aiPlanner.screen;
const announce = (message: string) => AccessibilityInfo.announceForAccessibility(message);

/**
 * La séance : ce que le planificateur a compris, puis la séance dans l'éditeur du constructeur. Un exercice dont la
 * fiche est à vérifier ou manque se tranche dans la séance, sans réponse écrite ni relance ; une seule action, en
 * bas de l'écran, crée le brouillon, et dit ce qui reste à compléter tant qu'il en reste.
 */
export function NativePlannerResult({
  orgId,
  context,
  proposal,
  usage,
  stream,
  online,
  error,
  onClarify,
  onProposal,
  onRestart,
  onError,
  onRemember,
  onDirty,
}: {
  orgId: string;
  context: Context;
  proposal: PlannerProposalResponse;
  usage: PlannerUsageResponse;
  stream: PlannerStreamState;
  online: boolean;
  error: string;
  onClarify: (input: ClarifyPlannerProposalInput) => void;
  onProposal: (proposal: PlannerProposalResponse) => void;
  onRestart: () => void;
  onError: (message: string) => void;
  onRemember: (exercise: ExerciseSummary) => void;
  /** Une séance à l'écran, pas encore créée : quitter l'écran la perdrait. */
  onDirty: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [reply, setReply] = useState("");
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
  const [picking, setPicking] = useState<{ index: number; picking: Picking } | null>(null);
  const pendingConfirmation = useRef<ConfirmPlannerProposalInput | null>(null);
  const display = (value: string) => plannerDisplayText(value, proposal);
  const drafts = prepared?.sessions ?? null;
  const stale = Boolean(prepared && prepared.version !== proposal.version);
  const running = stream.running || busy || stale || !online;
  useEffect(() => onDirty(Boolean(prepared?.edited) && !created), [prepared?.edited, created, onDirty]);

  // Une proposition arrive, ou change sur le serveur : sa séance se prépare tout de suite, sans geste de plus.
  // Quand l'écran a déjà appliqué le changement lui-même (une fiche choisie), il porte déjà cette version.
  const preparedVersion = prepared?.version;
  useEffect(() => {
    if (proposal.state !== "proposal" || preparedVersion === proposal.version) return;
    const controller = new AbortController();
    void api
      .preparePlannerDrafts(orgId, proposal.id, proposal.version, controller.signal)
      .then((result) => {
        setPrepared({ version: result.version, sessions: result.sessions.map(plannerAsSequence) });
        setWarnings(result.warnings ?? []);
        setSlots(result.slots ?? []);
        setLoads({});
        pendingConfirmation.current = null;
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) onError(errorMessage(cause));
      });
    return () => controller.abort();
  }, [orgId, proposal.id, proposal.version, proposal.state, preparedVersion, onError]);

  const updateDraft = useCallback((index: number, update: (draft: PlannerReviewedDraft) => PlannerReviewedDraft) => {
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
  const valid = Boolean(
    drafts &&
    confirmPlannerProposalInput.safeParse({ expectedVersion: proposal.version, sessions: drafts, confirmed: true })
      .success,
  );
  const next = plannerNextAction({ drafts, slots, valid, phasesReady, loads });
  // La séance de l'écran, quand elle peut partir telle quelle : c'est la base d'un ajustement ou d'un retrait.
  const screen = plannerScreenSessions(drafts);

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
      onError(errorMessage(cause));
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
      onError(errorMessage(cause));
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
    if (!drafts || next.kind !== "create" || !next.ready || running) return;
    setBusy(true);
    try {
      const input =
        pendingConfirmation.current ??
        confirmPlannerProposalInput.parse({ expectedVersion: proposal.version, sessions: drafts, confirmed: true });
      pendingConfirmation.current = input;
      const result = await api.confirmPlannerProposal(orgId, proposal.id, input);
      setCreated(result.sessions);
      await refreshLinked();
      announce(t.created);
      await client.invalidateQueries({ queryKey: ["coach-calendar", orgId] });
    } catch (cause) {
      // Une réponse perdue : la proposition dit si les brouillons existent déjà.
      const latest = await api.plannerProposal(orgId, proposal.id).catch(() => null);
      if (latest?.state === "committed" && latest.draftIds) setCreated(latest.draftIds);
      else onError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  const send = () => {
    const input = plannerClarifyInput({
      operationId: randomUUID(),
      expectedVersion: proposal.version,
      text: reply,
      // « Ajuster » part de la séance à l'écran : les retouches faites à la main sont gardées.
      sessions: proposal.state === "proposal" ? screen : null,
    });
    if (!input.success || running) return;
    onClarify(input.data);
    setReply("");
  };
  // Une fiche choisie dans la séance : le serveur la pose à la même place et retient le terme ; l'écran fait de
  // même sur place, sans rien recharger ni perdre.
  const settle = async (questionId: string, said: string, itemRef: string, exercise: Picked, done: () => void) => {
    if (running || !prepared) return;
    setBusy(true);
    try {
      const updated = await api.resolvePlannerExercise(orgId, proposal.id, {
        operationId: randomUUID(),
        expectedVersion: proposal.version,
        questionId,
        requestedName: said,
        choice: { kind: "existing", exerciseId: exercise.id },
        ...(screen ? { sessions: screen } : {}),
      });
      setPrepared((current) =>
        current
          ? { version: updated.version, sessions: plannerWithExercise(current.sessions, itemRef, exercise.id) }
          : current,
      );
      pendingConfirmation.current = null;
      done();
      onProposal(updated);
    } catch (cause) {
      onError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  const resolveSlot = async (
    slot: PlannerDraftSlot,
    choice: { kind: "use"; exercise: Picked } | { kind: "remove" },
  ) => {
    if (choice.kind === "use")
      return settle(slot.id, slot.said, slot.itemRef, choice.exercise, () => {
        setSlots((current) => current.filter((entry) => entry.id !== slot.id));
        announce(t.slot.filled(slot.said, choice.exercise.name));
      });
    if (running) return;
    setBusy(true);
    try {
      // Le retrait déplace le reste de la séance : elle repart de l'écran, puis se prépare de nouveau.
      const updated = await api.resolvePlannerExercise(orgId, proposal.id, {
        operationId: randomUUID(),
        expectedVersion: proposal.version,
        questionId: slot.id,
        requestedName: slot.said,
        choice: { kind: "remove" },
        ...(screen ? { sessions: screen } : {}),
      });
      announce(t.slot.removed(slot.said));
      onProposal(updated);
    } catch (cause) {
      onError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  const resolveProbable = (warning: PlannerDraftWarning, exercise: Picked) => {
    const ref = warning.itemRef;
    if (!ref) return;
    const said = warning.said ?? exercise.name;
    void settle(ref, said, ref, exercise, () => {
      setWarnings((current) =>
        current.map((list) => list.filter((entry) => entry.itemRef !== ref || entry.code !== "approximate_exercise")),
      );
      announce(t.probable.learned(said, exercise.name));
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

  let footer: ReactNode = null;
  if (created) footer = <Button label={t.calendar} onPress={() => router.push("/(coach)/planning")} />;
  else if (proposal.state === "proposal")
    footer = (
      <View style={{ gap: space.xs }}>
        {prepared?.edited ? (
          <Button
            label={m.aiPlanner.saveReview}
            variant="secondary"
            disabled={!valid || running}
            onPress={() => void save()}
          />
        ) : null}
        {conflict ? (
          <Button
            variant="secondary"
            disabled={busy}
            label={m.aiPlanner.reloadReview}
            onPress={() => void reloadReview()}
          />
        ) : null}
        {localCopy && !prepared?.edited ? (
          <Button variant="secondary" disabled={running} label={m.aiPlanner.restoreReview} onPress={restoreReview} />
        ) : null}
        {saveMessage ? <T accessibilityLiveRegion="polite">{saveMessage}</T> : null}
        {/* Ce qui retient encore le brouillon, dit à côté du bouton. */}
        {drafts && next.kind === "complete" ? (
          <T variant="small" accessibilityLiveRegion="polite">
            {t.slot.left(next.count)}
          </T>
        ) : drafts && next.kind === "create" && next.reason ? (
          <T variant="small" accessibilityLiveRegion="polite">
            {next.reason === "invalid" ? t.draftsInvalid : next.reason === "loads" ? t.loadsNeeded : t.phasesNeeded}
          </T>
        ) : null}
        {next.kind === "complete" ? (
          // Tant qu'un exercice attend sa fiche, le bouton dit lequel et l'ouvre.
          <Button
            testID="planner-complete"
            label={t.complete(next.count, next.said)}
            disabled={running}
            onPress={() => {
              const slot = slots.find((entry) => entry.id === next.slotId);
              if (slot) setPicking({ index: slot.session, picking: { kind: "slot", slot, create: false } });
            }}
          />
        ) : (
          <Button
            testID="planner-create-drafts"
            label={busy ? t.creating : next.count > 1 ? t.createMany(next.count) : t.create}
            loading={busy}
            disabled={!next.ready || running}
            onPress={() => void confirm()}
          />
        )}
        <T variant="caption" tone="muted">
          {t.noPublication}
        </T>
      </View>
    );

  return (
    <StackScreen title={m.aiPlanner.title} footer={footer}>
      <PlannerHeader
        usage={usage}
        stage={2}
        error={error || stream.error?.message || ""}
        step={error ? null : stream.error?.step}
      />
      {created ? (
        <View style={{ gap: space.md }}>
          <T accessibilityLiveRegion="polite" testID="planner-created">
            {t.created}
          </T>
          {created.map((session, index) => {
            const item = linked?.find((s) => s.id === session.id);
            if (item?.state === "unavailable") return <T key={session.id}>{m.aiPlanner.missingDraft}</T>;
            const name = item
              ? item.title + " · " + historyDate(item.date)
              : (drafts?.[index]?.draft.title ?? m.aiPlanner.createdDraft(index + 1));
            return (
              <View key={session.id}>
                <Button
                  variant="secondary"
                  label={item?.state === "published" ? m.aiPlanner.openPublished(name) : t.openDraft(name)}
                  onPress={() => router.push(`/session-builder/${session.id}`)}
                />
                {item?.state === "draft" ? (
                  <Button
                    variant="ghost"
                    label={m.aiPlanner.removeDraft}
                    onPress={() =>
                      Alert.alert(
                        m.aiPlanner.removeDraft,
                        m.aiPlanner.removeDraftDetail(item.title, historyDate(item.date)),
                        [
                          { text: m.common.cancel, style: "cancel" },
                          {
                            text: m.common.delete,
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await api.deleteSession(
                                  orgId,
                                  item.id,
                                  { expectedVersion: item.version, expectedLogCount: 0 },
                                  true,
                                );
                                await refreshLinked();
                                await client.invalidateQueries({ queryKey: ["coach-calendar", orgId] });
                              } catch (error) {
                                onError(errorMessage(error));
                              }
                            },
                          },
                        ],
                      )
                    }
                  />
                ) : null}
              </View>
            );
          })}
          <Button variant="ghost" label={t.again} onPress={onRestart} />
        </View>
      ) : (
        <>
          <View style={{ gap: space.sm }}>
            <View style={{ gap: 2 }}>
              <T variant="bodyStrong">{period}</T>
              {targets ? <T tone="muted">{targets}</T> : null}
            </View>
            {/* Ce que le planificateur a compris de la demande, avant la séance : le coach sait s'il a été entendu. */}
            {proposal.understanding?.summary && !stream.running ? (
              <View style={{ gap: space.xs }}>
                <SectionTitle>{t.understood}</SectionTitle>
                <T testID="planner-understood">{proposal.understanding.summary}</T>
              </View>
            ) : null}
            <Fold title={t.request}>
              {proposal.messages.map((message, i) => (
                <T key={i} tone="muted" selectable>
                  {display(message)}
                </T>
              ))}
            </Fold>
          </View>

          {/* Les étapes et le plan restent visibles jusqu'à ce que la séance complète les remplace. */}
          {stream.running || (stream.steps.length > 0 && !drafts && proposal.state === "proposal") ? (
            <NativePlannerProgress state={stream} />
          ) : null}

          {proposal.state === "processing" && !stream.running ? (
            <View style={{ gap: space.sm }}>
              <T accessibilityLiveRegion="polite">{t.processing}</T>
              <Button
                variant="secondary"
                label={t.refresh}
                disabled={!online}
                onPress={() => {
                  void api
                    .plannerProposal(orgId, proposal.id)
                    .then(onProposal)
                    .catch((cause: unknown) => onError(errorMessage(cause)));
                }}
              />
            </View>
          ) : null}

          {proposal.state === "failed" && !stream.running ? (
            <T tone="danger" accessibilityLiveRegion="assertive">
              {[
                proposal.failure?.step ? t.failedAt(proposal.failure.step) : null,
                proposal.failure?.message ?? t.failed,
              ]
                .filter(Boolean)
                .join(" ")}
            </T>
          ) : null}

          {proposal.state === "clarification" && !stream.running ? (
            <View style={{ gap: space.md }}>
              <SectionTitle>{t.questions}</SectionTitle>
              {proposal.interpretation?.questions.map((q) => (
                <View key={`${proposal.clarificationCount}-${q.id}`} style={{ gap: space.sm }}>
                  <T variant="bodyStrong">{display(q.question)}</T>
                  {q.field === "exercise" ? (
                    <T variant="small" tone="muted">
                      {t.exerciseQuestion}
                    </T>
                  ) : null}
                  {q.options.length ? (
                    <PillRow>
                      {q.options.map((option, i) => (
                        <Pill
                          key={i}
                          label={display(option)}
                          pressed={false}
                          disabled={running}
                          onPress={() => setReply((text) => `${text}${text ? "\n" : ""}${display(option)}`)}
                        />
                      ))}
                    </PillRow>
                  ) : null}
                </View>
              ))}
              {proposal.clarificationCount < PLANNER_MAX_CLARIFICATIONS ? (
                <>
                  <Field
                    testID="planner-reply"
                    label={t.answer}
                    hint={t.answerHint}
                    multiline
                    value={reply}
                    editable={!running}
                    error={reply.length > PLANNER_TEXT_LIMIT ? t.textLimit(reply.length, PLANNER_TEXT_LIMIT) : null}
                    onChangeText={setReply}
                  />
                  <Button
                    variant="secondary"
                    label={mic.recording ? m.aiPlanner.stopDictation : m.aiPlanner.dictateReply}
                    disabled={!mic.recording && mic.busy}
                    onPress={mic.recording ? mic.stop : mic.start}
                  />
                  {mic.canCheck ? <Button label={m.aiPlanner.checkTranscription} onPress={mic.check} /> : null}
                  {mic.status || mic.error ? <T accessibilityLiveRegion="polite">{mic.error || mic.status}</T> : null}
                  <Button
                    testID="planner-reply-send"
                    label={t.sendAnswer}
                    disabled={running || mic.busy || !reply.trim() || reply.length > PLANNER_TEXT_LIMIT}
                    onPress={send}
                  />
                </>
              ) : (
                <T>{t.questionLimit}</T>
              )}
            </View>
          ) : null}

          {proposal.state === "proposal" ? (
            <View style={{ gap: space.lg }} accessibilityState={{ busy: !drafts || stale }}>
              <View style={{ gap: 2 }}>
                <SectionTitle>{t.sessionTitle}</SectionTitle>
                <T variant="small" tone="muted">
                  {t.sessionHint}
                </T>
              </View>
              {proposal.interpretation?.assumptions.length ? (
                <View style={{ gap: space.xs }}>
                  <T variant="smallStrong">{t.assumptions}</T>
                  {proposal.interpretation.assumptions.map((line, i) => (
                    <T key={i} variant="small" tone="muted">
                      {display(line)}
                    </T>
                  ))}
                </View>
              ) : null}
              {!drafts ? <T accessibilityLiveRegion="polite">{t.loadingSession}</T> : null}
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
                  picking={picking?.index === index ? picking.picking : null}
                  onPicking={(value) => setPicking(value ? { index, picking: value } : null)}
                  onUpdate={updateDraft}
                  onLoadsReady={acceptLoads}
                  onSlot={(slot, choice) => void resolveSlot(slot, choice)}
                  onProbable={resolveProbable}
                  onRemember={onRemember}
                />
              ))}
              {drafts ? (
                <Fold
                  title={t.adjust}
                  detail={t.adjustCount(adjustments, PLANNER_MAX_ADJUSTMENTS)}
                  testID="planner-adjust-fold"
                >
                  {adjustments < PLANNER_MAX_ADJUSTMENTS ? (
                    <>
                      <Field
                        testID="planner-adjust"
                        label={t.adjustLabel}
                        hint={t.adjustHint}
                        multiline
                        value={reply}
                        editable={!running}
                        onChangeText={setReply}
                      />
                      <Button
                        testID="planner-adjust-send"
                        variant="secondary"
                        label={t.adjustSend}
                        disabled={running || !reply.trim() || reply.length > PLANNER_TEXT_LIMIT}
                        onPress={send}
                      />
                    </>
                  ) : (
                    <T>{t.adjustLimit}</T>
                  )}
                </Fold>
              ) : null}
            </View>
          ) : null}

          {!running ? <Button variant="ghost" label={t.edit} onPress={onRestart} /> : null}
        </>
      )}
    </StackScreen>
  );
}
