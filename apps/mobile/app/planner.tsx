import { uuid, isoDate } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { NativePlanner } from "../src/features/native-planner";
import { PlannerConsentNative } from "../src/features/planner-consent";
import { api } from "../src/lib/api";
import { personalAthleteOf } from "../src/lib/personal-space";
import { useTrainingSpace } from "../src/lib/queries";
import { StackScreen } from "../src/ui/screen";
import { T } from "../src/ui/primitives";
import { ErrorState, LoadingState } from "../src/ui/states";

function PlannerLoader({
  orgId,
  userId,
  proposalId,
  date,
  groupId,
  self,
}: {
  orgId: string;
  userId: string;
  proposalId?: string;
  date?: string;
  groupId?: string;
  // Espace personnel : la fiche du titulaire, seul destinataire possible.
  self: string | null;
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
      personal={Boolean(self)}
      orgId={orgId}
      context={context}
      initial={initial}
      initialUsage={usage}
      spaceEquipment={equipment}
      initialSelection={{
        period: { from: chosenDate, to: chosenDate },
        groupIds: self ? [] : groupIds,
        athleteIds: self ? [self] : [],
        exerciseIds: [],
        phaseChoices: [],
      }}
    />
  );
}

export default function PlannerScreen() {
  const { me, space, orgId } = useTrainingSpace(true);
  const params = useLocalSearchParams<{ proposalId?: string; date?: string; groupId?: string }>();
  // La proposition ouverte est celle de l'arrivée sur l'écran : l'écran garde ensuite son travail.
  const [opened] = useState(params.proposalId || undefined);
  if (!me.data)
    return (
      <StackScreen title={m.aiPlanner.title}>
        <LoadingState />
      </StackScreen>
    );
  // L'athlète d'un club sans carnet planifie pour lui dans un carnet à ouvrir : il y est mené, sans « désactivé ».
  if (
    space?.role === "athlete" &&
    space.kind !== "personal" &&
    me.data.notebook?.available &&
    !me.data.spaces.some((s) => s.kind === "personal")
  )
    return <Redirect href={{ pathname: "/(auth)/onboarding/solo", params: { ensuite: "planificateur" } }} />;
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
      self={personalAthleteOf(space)}
    />
  );
}
