import type {
  ExerciseSummary,
  PlannerProposalResponse,
  PlannerSelection,
  PlannerUsageResponse,
} from "@tartan/contracts";
import { phasePlanningKey, plannerProposalsExhausted, type PhasePlanningReadiness } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { usePreventRemove } from "@react-navigation/native";
import { randomUUID } from "expo-crypto";
import { useNavigation, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { api } from "../lib/api";
import { useIsOnline } from "../lib/network";
import {
  PLANNER_TEXT_LIMIT,
  plannerAsksPhases,
  plannerCreateInput,
  plannerRequestFrom,
  type PlannerEquipment,
  type PlannerRequestValue,
} from "../lib/planner-flow";
import { Button, T } from "../ui/primitives";
import { StackScreen } from "../ui/screen";
import { space } from "../ui/theme";
import { PlannerHeader } from "./planner-header";
import { NativePlannerProgress } from "./planner-progress";
import { NativePlannerRequest } from "./planner-request";
import { NativePlannerResult } from "./planner-result";
import { usePlannerStream } from "./use-planner-stream";

type Context = Awaited<ReturnType<typeof api.sessionBuilder>>;
const t = m.aiPlanner.screen;

/**
 * Le planificateur de l'app native, en deux temps, comme le web. « Demande » : pour qui, quand, et un seul champ,
 * en un seul envoi. « Séance » : ce qui a été compris, puis la séance dans l'éditeur du constructeur, l'état de
 * chaque exercice à sa place, et une seule action pour créer le brouillon.
 */
export function NativePlanner({
  personal,
  orgId,
  context: initialContext,
  initial,
  initialUsage,
  initialSelection,
  spaceEquipment,
}: {
  personal: boolean;
  orgId: string;
  context: Context;
  initial: PlannerProposalResponse | null;
  initialUsage: PlannerUsageResponse;
  initialSelection: PlannerSelection;
  /** Le matériel du profil de l'espace : celui que le serveur retient quand rien n'est précisé. */
  spaceEquipment: PlannerEquipment[];
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const online = useIsOnline();
  // Les fiches connues de l'écran : la bibliothèque à l'ouverture, puis chaque fiche créée depuis.
  const [context, setContext] = useState(initialContext);
  const remember = useCallback(
    (exercise: ExerciseSummary) =>
      setContext((old) =>
        old.exercises.some((e) => e.id === exercise.id) ? old : { ...old, exercises: [...old.exercises, exercise] },
      ),
    [],
  );
  const [proposal, setProposal] = useState(initial);
  const [request, setRequest] = useState<PlannerRequestValue>(() =>
    plannerRequestFrom(initial?.selection ?? initialSelection, spaceEquipment),
  );
  const [phase, setPhase] = useState<PhasePlanningReadiness | null>(null);
  const [usage, setUsage] = useState(initialUsage);
  const [error, setError] = useState("");
  const [dictating, setDictating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const receive = useCallback(
    (next: PlannerProposalResponse) => {
      setProposal(next);
      setError("");
      void api
        .plannerUsage(orgId)
        .then(setUsage)
        .catch(() => undefined);
    },
    [orgId],
  );
  const stream = usePlannerStream(orgId, receive);
  const { clearError } = stream;
  const reset = useCallback(() => {
    setError("");
    clearError();
  }, [clearError]);
  const fail = useCallback((message: string) => setError(message), []);
  const changeRequest = useCallback(
    (update: (value: PlannerRequestValue) => PlannerRequestValue) => setRequest(update),
    [],
  );
  const acceptPhase = useCallback(
    (state: PhasePlanningReadiness) => setPhase((old) => (JSON.stringify(old) === JSON.stringify(state) ? old : state)),
    [],
  );

  // Quitter l'écran perdrait ce qui n'est pas envoyé, ou une séance pas encore créée.
  usePreventRemove(
    stream.state.running || dictating || dirty || (!proposal && Boolean(request.text.trim())),
    ({ data }) => {
      if (dictating) return;
      Alert.alert(m.common.back, m.aiPlanner.leaveDraft, [
        { text: m.common.cancel, style: "cancel" },
        { text: m.common.yes, onPress: () => navigation.dispatch(data.action) },
      ]);
    },
  );

  const asksPhases = plannerAsksPhases(request, context.phasesEnabled);
  const phasesReady =
    !asksPhases ||
    Boolean(phase?.ready && phase.key === phasePlanningKey(request.date, request.groupIds, request.athleteIds));
  const exhausted = plannerProposalsExhausted(usage);
  const hasRecipients = context.groups.length + context.athletes.length > 0;
  const draft = plannerCreateInput(request, {
    id: "00000000-0000-4000-8000-000000000000",
    requestedAt: new Date(0).toISOString(),
    spaceEquipment,
    phaseChoices: asksPhases ? (phase?.review?.choices ?? []) : null,
  });
  const ready =
    draft.success &&
    hasRecipients &&
    phasesReady &&
    !exhausted &&
    !dictating &&
    online &&
    request.text.length <= PLANNER_TEXT_LIMIT;

  if (proposal)
    return (
      <NativePlannerResult
        key={proposal.id}
        personal={personal}
        orgId={orgId}
        context={context}
        proposal={proposal}
        usage={usage}
        stream={stream.state}
        online={online}
        error={error}
        onClarify={(input) => {
          reset();
          void stream.clarify(proposal.id, input);
        }}
        onProposal={receive}
        onError={fail}
        onRemember={remember}
        onDirty={setDirty}
        onRestart={() => {
          // La demande reste préremplie : une nouvelle proposition repart de ce que le coach avait écrit.
          setRequest(plannerRequestFrom(proposal.selection, spaceEquipment, proposal.messages[0] ?? ""));
          setPhase(null);
          setDirty(false);
          setProposal(null);
          reset();
        }}
      />
    );

  return (
    <StackScreen
      title={m.aiPlanner.title}
      footer={
        stream.state.running ? null : (
          // L'action reste à portée de pouce : une seule, au bas de l'écran.
          <Button
            testID="planner-generate"
            label={t.prepare}
            disabled={!ready}
            accessibilityHint={asksPhases && !phasesReady ? t.phasesWaiting : undefined}
            onPress={() => {
              if (!ready || !draft.success || stream.state.running) return;
              reset();
              void stream.create({ ...draft.data, id: randomUUID(), requestedAt: new Date().toISOString() });
            }}
          />
        )
      }
    >
      {personal ? <T variant="smallStrong">{m.aiPlanner.personalRecipient}</T> : null}
      <PlannerHeader
        usage={usage}
        stage={1}
        error={error || stream.state.error?.message || ""}
        step={error ? null : stream.state.error?.step}
      />
      {/* Pendant la génération, les étapes prennent la place de la demande : visibles sans défiler. */}
      {stream.state.running ? (
        <NativePlannerProgress state={stream.state} />
      ) : (
        <View style={{ gap: space.xl }}>
          <NativePlannerRequest
            orgId={orgId}
            context={context}
            spaceEquipment={spaceEquipment}
            value={request}
            onChange={changeRequest}
            disabled={!online}
            phase={phase}
            onPhase={acceptPhase}
            onDictationBusy={setDictating}
          />
          <Button variant="ghost" label={m.aiPlanner.recent} onPress={() => router.push("/planner-proposals")} />
        </View>
      )}
    </StackScreen>
  );
}
