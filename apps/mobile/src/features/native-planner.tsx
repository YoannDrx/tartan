import {
  createPlannerProposalInput,
  clarifyPlannerProposalInput,
  confirmPlannerProposalInput,
  type CreatePlannerProposalInput,
  type ClarifyPlannerProposalInput,
  type PlannerProposalResponse,
  type PlannerReviewedDraft,
  type PlannerSelection,
  type PlannerUsageResponse,
} from "@tartan/contracts";
import {
  plannerDisplayText,
  plannerProposalsExhausted,
  phasePlanningKey,
  type PhasePlanningReadiness,
} from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { usePreventRemove } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { useIsOnline } from "../lib/network";
import { Button, Divider, Field, SectionTitle, T } from "../ui/primitives";
import { StackScreen } from "../ui/screen";
import { space } from "../ui/theme";
import { PlannerDictation } from "./planner-dictation";
import { PlannerDraftReview } from "./planner-draft-review";
import { NativePlannerSelection } from "./planner-selection";

type Context = Awaited<ReturnType<typeof api.sessionBuilder>>;
const t = m.aiPlanner;

export function NativePlanner({
  orgId,
  context,
  initial,
  initialUsage,
  initialSelection,
  onNew,
}: {
  orgId: string;
  context: Context;
  initial: PlannerProposalResponse | null;
  initialUsage: PlannerUsageResponse;
  initialSelection: PlannerSelection;
  onNew: (selection: PlannerSelection) => void;
}) {
  const [selection, setSelection] = useState(initial?.selection ?? initialSelection);
  const [contextReady, setContextReady] = useState(Boolean(initial));
  const [text, setText] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [proposal, setProposal] = useState(initial);
  const displayText = (value: string) => plannerDisplayText(value, proposal);
  const [usage, setUsage] = useState(initialUsage);
  const [reply, setReply] = useState("");
  const [replyReviewed, setReplyReviewed] = useState(false);
  const [drafts, setDrafts] = useState<PlannerReviewedDraft[] | null>(null);
  const [draftsReviewed, setDraftsReviewed] = useState(false);
  const [phases, setPhases] = useState<Record<number, PhasePlanningReadiness>>({});
  const [loadsReady, setLoadsReady] = useState<Record<number, { key: string; ready: boolean }>>({});
  const [created, setCreated] = useState(initial?.draftIds ?? null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [replySent, setReplySent] = useState(false);
  const lock = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      activeRequest.current?.abort();
    };
  }, []);
  const pendingCreate = useRef<CreatePlannerProposalInput | null>(null);
  const pendingReply = useRef<ClarifyPlannerProposalInput | null>(null);
  const pendingConfirmation = useRef<Parameters<typeof api.confirmPlannerProposal>[2] | null>(null);
  const online = useIsOnline();
  const router = useRouter();
  const navigation = useNavigation();
  const client = useQueryClient();
  usePreventRemove(
    !created && (busy || recording || Boolean(text.trim()) || Boolean(reply.trim()) || Boolean(drafts)),
    ({ data }) => {
      if (lock.current || recording) return;
      Alert.alert(m.common.back, t.leaveDraft, [
        { text: m.common.cancel, style: "cancel" },
        { text: m.common.yes, onPress: () => navigation.dispatch(data.action) },
      ]);
    },
  );
  const run = async (work: (signal: AbortSignal) => Promise<void>) => {
    if (lock.current || recording || !online) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const abort = new AbortController();
    activeRequest.current = abort;
    const timer = setTimeout(() => abort.abort(), 120_000);
    try {
      await work(abort.signal);
    } catch (cause) {
      if (alive.current) setError(errorMessage(cause));
    } finally {
      clearTimeout(timer);
      activeRequest.current = null;
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const updateUsage = async (signal: AbortSignal) => {
    try {
      const next = await api.plannerUsage(orgId, signal);
      if (alive.current) setUsage(next);
    } catch {
      /* un résultat reçu reste affiché */
    }
  };
  const receive = (next: PlannerProposalResponse) => {
    if (!alive.current) return;
    setProposal(next);
    setDrafts(null);
    setDraftsReviewed(false);
    setCreated(next.draftIds);
    setReply("");
    setReplyReviewed(false);
    setReplySent(false);
    pendingReply.current = null;
    router.setParams({ proposalId: next.id });
  };
  const generate = () =>
    run(async (signal) => {
      const input =
        pendingCreate.current ??
        createPlannerProposalInput.parse({
          id: randomUUID(),
          requestedAt: new Date().toISOString(),
          selection,
          text,
          reviewed,
        });
      pendingCreate.current = input;
      setSent(true);
      receive(await api.createPlannerProposal(orgId, input, signal));
      await updateUsage(signal);
    });
  const refresh = () =>
    run(async (signal) => {
      const id = proposal?.id ?? pendingCreate.current?.id;
      if (id) {
        const next = await api.plannerProposal(orgId, id, signal);
        if (!alive.current) return;
        if (pendingConfirmation.current && next.state !== "committed" && next.version === proposal?.version) {
          // Réponse perdue : garder les ajustements locaux pour une relecture, sans
          // rejouer une confirmation ancienne après une correction de phase.
          pendingConfirmation.current = null;
          setDraftsReviewed(false);
          setError(t.reviewAgain);
        } else receive(next);
      }
      await updateUsage(signal);
    });
  const clarify = () =>
    run(async (signal) => {
      if (!proposal) return;
      const input =
        pendingReply.current ??
        clarifyPlannerProposalInput.parse({
          operationId: randomUUID(),
          expectedVersion: proposal.version,
          text: reply,
          reviewed: replyReviewed,
        });
      pendingReply.current = input;
      setReplySent(true);
      receive(await api.clarifyPlannerProposal(orgId, proposal.id, input, signal));
      await updateUsage(signal);
    });
  const prepare = () =>
    run(async (signal) => {
      if (!proposal) return;
      const result = await api.preparePlannerDrafts(orgId, proposal.id, proposal.version, signal);
      if (!alive.current) return;
      setDrafts(result.sessions);
      setPhases({});
      setDraftsReviewed(false);
      pendingConfirmation.current = null;
    });
  const updateDraft = useCallback((index: number, update: (session: PlannerReviewedDraft) => PlannerReviewedDraft) => {
    setDrafts((old) => {
      if (!old?.[index]) return old;
      const next = update(old[index]);
      return next === old[index] ? old : old.map((item, i) => (i === index ? next : item));
    });
    setDraftsReviewed(false);
  }, []);
  const acceptPhase = useCallback((index: number, state: PhasePlanningReadiness) => {
    setPhases((old) => (JSON.stringify(old[index]) === JSON.stringify(state) ? old : { ...old, [index]: state }));
  }, []);
  const acceptLoads = useCallback(
    (index: number, key: string, ready: boolean) =>
      setLoadsReady((old) =>
        old[index]?.key === key && old[index]?.ready === ready ? old : { ...old, [index]: { key, ready } },
      ),
    [],
  );
  const confirm = () =>
    run(async (signal) => {
      if (!proposal || !drafts || !draftsReviewed) return;
      const input =
        pendingConfirmation.current ??
        confirmPlannerProposalInput.parse({ expectedVersion: proposal.version, sessions: drafts, confirmed: true });
      pendingConfirmation.current = input;
      const result = await api.confirmPlannerProposal(orgId, proposal.id, input, signal);
      if (!alive.current) return;
      setCreated(result.sessions);
      await client.invalidateQueries({ queryKey: ["coach-calendar", orgId] });
    });
  const phaseReady =
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
  const draftsValid =
    proposal &&
    drafts &&
    drafts.every(
      (draft) =>
        draft.date >= selection.period.from && draft.date <= selection.period.to && draft.assignments.length > 0,
    ) &&
    confirmPlannerProposalInput.safeParse({ expectedVersion: proposal.version, sessions: drafts, confirmed: true })
      .success;
  const disabled = busy || recording || !online;
  const exhausted = plannerProposalsExhausted(usage);
  return (
    <StackScreen title={t.title}>
      <T variant="smallStrong">{t.beta}</T>
      <T>{t.lead}</T>
      {exhausted && !proposal ? <T accessibilityLiveRegion="polite">{t.quotaExceeded}</T> : null}
      <T variant="small" tone="muted">
        {t.usage(usage.used.proposals, usage.reserved.proposals, usage.limit.proposals)}
      </T>
      <T variant="small" tone="muted">
        {t.audioUsage(usage.used.audioSeconds, usage.reserved.audioSeconds, usage.limit.audioSeconds)}
      </T>
      <T variant="small" tone="muted">
        {t.timeZone(usage.timeZone)}
      </T>
      {!proposal && !contextReady ? (
        <Button variant="secondary" label={t.recent} onPress={() => router.push("/planner-proposals")} />
      ) : null}
      {error ? (
        <T tone="danger" accessibilityLiveRegion="assertive">
          {error}
        </T>
      ) : null}
      {!proposal && !contextReady ? (
        <NativePlannerSelection
          orgId={orgId}
          context={context}
          initial={selection}
          onContinue={(value) => {
            setSelection(value);
            setContextReady(true);
          }}
        />
      ) : null}
      {!proposal && contextReady ? (
        <View style={{ gap: space.md }}>
          <T variant="bodyStrong">
            {historyDate(selection.period.from)} – {historyDate(selection.period.to)}
          </T>
          <T>
            {[
              ...context.groups.filter((g) => selection.groupIds.includes(g.id)).map((g) => g.name),
              ...context.athletes
                .filter((a) => selection.athleteIds.includes(a.id))
                .map((a) => `${a.firstName} ${a.lastName}`),
            ].join(", ")}
          </T>
          <Button
            variant="secondary"
            label={t.changeContext}
            disabled={disabled || sent}
            onPress={() => setContextReady(false)}
          />
          <Field
            testID="planner-instructions"
            label={t.instructions}
            hint={t.instructionsHint}
            multiline
            value={text}
            editable={!disabled && !sent}
            onChangeText={(value) => {
              setText(value);
              setReviewed(false);
            }}
          />
          {text.length > 12000 ? <T tone="danger">{t.textTooLong}</T> : null}
          {!sent ? (
            <PlannerDictation
              orgId={orgId}
              disabled={busy || !online}
              onBusyChange={setRecording}
              onText={(value) => {
                setText((old) => (old.trim() ? `${old}\n${value}` : value));
                setReviewed(false);
              }}
            />
          ) : null}
          <Button
            variant="secondary"
            label={t.reviewed}
            selected={reviewed}
            disabled={disabled || sent}
            onPress={() => setReviewed(!reviewed)}
          />
          {sent ? <T>{t.immutableRequest}</T> : null}
          <Button
            label={t.propose}
            loading={busy}
            disabled={disabled || exhausted || !reviewed || !text.trim() || text.length > 12000}
            onPress={() => {
              void generate();
            }}
          />
          {sent ? (
            <Button
              variant="secondary"
              label={t.recover}
              disabled={disabled}
              onPress={() => {
                void refresh();
              }}
            />
          ) : null}
        </View>
      ) : null}
      {proposal && !created ? (
        <View style={{ gap: space.md }}>
          <Divider />
          <SectionTitle>{t.instructions}</SectionTitle>
          {proposal.messages.map((message, i) => (
            <T key={i}>{displayText(message)}</T>
          ))}
          {proposal.pendingText ? (
            <>
              <SectionTitle>{t.pendingAnswer}</SectionTitle>
              <T selectable>{displayText(proposal.pendingText)}</T>
            </>
          ) : null}
          <T variant="small" tone="muted">
            {t.expiry(new Date(proposal.expiresAt).toLocaleString("fr-FR"))}
          </T>
          {proposal.state === "processing" ? <T>{t.processing}</T> : null}
          {proposal.state === "failed" ? <T tone="danger">{t.proposalFailed}</T> : null}
          {proposal.state === "clarification" ? (
            <>
              <SectionTitle>{t.clarifyTitle}</SectionTitle>
              <T>{t.clarificationCount(proposal.clarificationCount)}</T>
              {proposal.interpretation?.questions.map((q) => (
                <View key={q.id} style={{ gap: space.sm }}>
                  <T variant="bodyStrong">{displayText(q.question)}</T>
                  {q.options.map((option, i) => (
                    <Button
                      key={i}
                      variant="secondary"
                      disabled={disabled || replySent}
                      label={displayText(option)}
                      onPress={() => {
                        setReply((old) => `${old}${old ? "\n" : ""}${displayText(q.question)} ${displayText(option)}`);
                        setReplyReviewed(false);
                      }}
                    />
                  ))}
                </View>
              ))}
              {proposal.clarificationCount < 5 ? (
                <>
                  <Field
                    label={t.clarificationAnswer}
                    multiline
                    value={reply}
                    editable={!disabled && !replySent}
                    onChangeText={(value) => {
                      setReply(value);
                      setReplyReviewed(false);
                    }}
                  />
                  {reply.length > 12000 ? <T tone="danger">{t.textTooLong}</T> : null}
                  <Button
                    label={t.reviewed}
                    variant="secondary"
                    selected={replyReviewed}
                    disabled={disabled || replySent}
                    onPress={() => setReplyReviewed(!replyReviewed)}
                  />
                  {replySent ? <T>{t.immutableRequest}</T> : null}
                  <Button
                    label={t.clarify}
                    loading={busy}
                    disabled={disabled || !replyReviewed || !reply.trim() || reply.length > 12000}
                    onPress={() => {
                      void clarify();
                    }}
                  />
                </>
              ) : (
                <T>{t.clarificationLimit}</T>
              )}
            </>
          ) : null}
          {proposal.interpretation?.assumptions.length ? (
            <>
              <SectionTitle>{t.assumptions}</SectionTitle>
              {proposal.interpretation.assumptions.map((value, i) => (
                <T key={i}>{displayText(value)}</T>
              ))}
            </>
          ) : null}
          {proposal.interpretation?.suggestions.length ? (
            <>
              <SectionTitle>{t.suggestions}</SectionTitle>
              {proposal.interpretation.suggestions.map((value, i) => (
                <T key={i}>{displayText(value)}</T>
              ))}
            </>
          ) : null}
          {proposal.state === "proposal" ? (
            <>
              {proposal.interpretation?.sessions.map((session, i) => (
                <View key={i} style={{ gap: space.sm }}>
                  <T variant="bodyStrong">
                    {historyDate(session.date)} · {displayText(session.title)}
                  </T>
                  <T>
                    {session.targetTokens
                      .map(
                        (token) =>
                          proposal.targets.find((target) => target.token === token)?.label ?? m.common.notFound,
                      )
                      .join(", ")}
                  </T>
                  {session.blocks
                    .flatMap((block) => block.items)
                    .map((item, j) => (
                      <T key={j}>
                        {t.quotedInstruction} : {displayText(item.instruction)}
                      </T>
                    ))}
                </View>
              ))}
              {!drafts ? (
                <Button
                  label={t.prepareReview}
                  disabled={disabled}
                  onPress={() => {
                    void prepare();
                  }}
                />
              ) : null}
            </>
          ) : null}
          {!drafts ? (
            <Button
              variant="secondary"
              label={t.refresh}
              disabled={disabled}
              onPress={() => {
                void refresh();
              }}
            />
          ) : null}
          {drafts ? (
            <>
              <T>{t.noAutomaticLoad}</T>
              {drafts.map((session, index) => (
                <PlannerDraftReview
                  key={index}
                  index={index}
                  session={session}
                  context={context}
                  proposal={proposal}
                  orgId={orgId}
                  busy={disabled || Boolean(pendingConfirmation.current)}
                  onUpdate={updateDraft}
                  onPhaseReady={acceptPhase}
                  onLoadsReady={acceptLoads}
                />
              ))}
              <T>{t.noPublication}</T>
              {!draftsValid ? <T accessibilityLiveRegion="polite">{t.draftsInvalid}</T> : null}
              {drafts.some((draft, i) => !loadsReady[i]?.ready || loadsReady[i]?.key !== JSON.stringify(draft)) ? (
                <T>{t.previewRequired}</T>
              ) : null}
              <Button
                label={t.reviewedDrafts}
                variant="secondary"
                selected={draftsReviewed}
                disabled={disabled}
                onPress={() => setDraftsReviewed(!draftsReviewed)}
              />
              <Button
                label={t.confirmDrafts(drafts.length)}
                disabled={
                  disabled ||
                  !draftsReviewed ||
                  !phaseReady ||
                  !draftsValid ||
                  drafts.some((draft, i) => !loadsReady[i]?.ready || loadsReady[i]?.key !== JSON.stringify(draft))
                }
                loading={busy}
                onPress={() => {
                  void confirm();
                }}
              />
              {pendingConfirmation.current ? (
                <Button
                  variant="secondary"
                  label={t.recover}
                  disabled={disabled}
                  onPress={() => {
                    void refresh();
                  }}
                />
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}
      {created ? (
        <View style={{ gap: space.sm }}>
          <T accessibilityLiveRegion="polite">{t.draftsCreated}</T>
          {created.map((session, index) => (
            <Button
              key={session.id}
              label={`${m.common.edit} · ${drafts?.[index]?.draft.title ?? t.createdDraft(index + 1)}`}
              variant="secondary"
              onPress={() => router.push(`/session-builder/${session.id}`)}
            />
          ))}
          <Button label={m.nav.calendrier} onPress={() => router.push("/(coach)/planning")} />
        </View>
      ) : null}
      {(proposal || sent) && !disabled ? (
        <Button
          variant="ghost"
          label={t.newProposal}
          onPress={() =>
            Alert.alert(t.newProposal, t.newProposalHint, [
              { text: m.common.cancel, style: "cancel" },
              { text: m.common.yes, onPress: () => onNew(selection) },
            ])
          }
        />
      ) : null}
    </StackScreen>
  );
}
