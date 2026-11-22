import { uuid, isoDate } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { NativePlanner } from "../src/features/native-planner";
import { PlannerConsentNative } from "../src/features/planner-consent";
import { api } from "../src/lib/api";
import { useActiveSpace } from "../src/lib/queries";
import { StackScreen } from "../src/ui/screen";
import { T } from "../src/ui/primitives";
import { ErrorState, LoadingState } from "../src/ui/states";

function PlannerLoader({
  orgId,
  userId,
  proposalId,
  date,
  groupId,
}: {
  orgId: string;
  userId: string;
  proposalId?: string;
  date?: string;
  groupId?: string;
}) {
  const data = useQuery({
    queryKey: ["native-planner", orgId, userId, proposalId ?? "new"],
    queryFn: async ({ signal }) => {
      // Vérification fraîche du flag/rôle/offre avant d'ouvrir le formulaire ou le micro.
      const usage = await api.plannerUsage(orgId, signal);
      const [context, initial, space] = await Promise.all([
        api.sessionBuilder(orgId),
        proposalId ? api.plannerProposal(orgId, proposalId, signal) : null,
        // Le matériel du profil de l'espace préremplit les précisions ; sans lui, rien n'est supposé.
        api.organization(orgId).catch(() => null),
      ]);
      return { usage, context, initial, equipment: space?.availableEquipment ?? [] };
    },
    retry: false,
    networkMode: "always",
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  if (!data.data || data.isError)
    return (
      <StackScreen title={m.aiPlanner.title}>
        {data.isPending ? (
          <LoadingState />
        ) : (
          <ErrorState
            error={data.error}
            onRetry={() => {
              void data.refetch();
            }}
          />
        )}
      </StackScreen>
    );
  const { context, usage, initial, equipment } = data.data;
  const chosenDate = isoDate.safeParse(date).success
    ? date!
    : new Intl.DateTimeFormat("en-CA", { timeZone: usage.timeZone }).format(new Date());
  // Quand l'espace n'a qu'un groupe, il est déjà choisi : la demande part en un champ et un geste.
  const groupIds = context.groups.some((g) => g.id === groupId)
    ? [groupId!]
    : context.groups.length === 1
      ? [context.groups[0]!.id]
      : [];
  return (
    <NativePlanner
      orgId={orgId}
      context={context}
      initial={initial}
      initialUsage={usage}
      spaceEquipment={equipment}
      initialSelection={{
        period: { from: chosenDate, to: chosenDate },
        groupIds,
        athleteIds: [],
        exerciseIds: [],
        phaseChoices: [],
      }}
    />
  );
}

export default function PlannerScreen() {
  const { me, space, orgId } = useActiveSpace();
  const params = useLocalSearchParams<{ proposalId?: string; date?: string; groupId?: string }>();
  // La proposition ouverte est celle de l'arrivée sur l'écran : l'écran garde ensuite son travail.
  const [opened] = useState(params.proposalId || undefined);
  if (!me.data)
    return (
      <StackScreen title={m.aiPlanner.title}>
        <LoadingState />
      </StackScreen>
    );
  if (!space?.aiPlannerEnabled || !orgId)
    return (
      <StackScreen title={m.aiPlanner.title}>
        <T>{m.aiPlanner.disabled}</T>
      </StackScreen>
    );
  if (!me.data.preferences?.aiConsent) return <PlannerConsentNative />;
  if (opened && !uuid.safeParse(opened).success)
    return (
      <StackScreen title={m.aiPlanner.title}>
        <T>{m.common.notFound}</T>
      </StackScreen>
    );
  return (
    <PlannerLoader
      key={`${me.data.id}:${orgId}:${opened ?? "new"}`}
      userId={me.data.id}
      orgId={orgId}
      proposalId={opened}
      date={params.date}
      groupId={params.groupId}
    />
  );
}
