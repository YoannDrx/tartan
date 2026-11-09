import { uuid, isoDate, type PlannerSelection } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { NativePlanner } from "../src/features/native-planner";
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
  revision,
  newSelection,
  onNew,
}: {
  orgId: string;
  userId: string;
  proposalId?: string;
  date?: string;
  groupId?: string;
  revision: number;
  newSelection?: PlannerSelection;
  onNew: (selection: PlannerSelection) => void;
}) {
  const data = useQuery({
    queryKey: ["native-planner", orgId, userId, proposalId ?? "new", revision],
    queryFn: async ({ signal }) => {
      // Vérification fraîche du flag/rôle/offre avant d'ouvrir le formulaire ou le micro.
      const usage = await api.plannerUsage(orgId, signal);
      const [context, initial] = await Promise.all([
        api.sessionBuilder(orgId),
        proposalId ? api.plannerProposal(orgId, proposalId, signal) : null,
      ]);
      return { usage, context, initial };
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
  const chosenDate = isoDate.safeParse(date).success
    ? date!
    : new Intl.DateTimeFormat("en-CA", { timeZone: data.data.usage.timeZone }).format(new Date());
  return (
    <NativePlanner
      orgId={orgId}
      context={data.data.context}
      initial={data.data.initial}
      initialUsage={data.data.usage}
      onNew={onNew}
      initialSelection={
        newSelection ?? {
          period: { from: chosenDate, to: chosenDate },
          groupIds: data.data.context.groups.some((g) => g.id === groupId) ? [groupId!] : [],
          athleteIds: [],
          exerciseIds: [],
          phaseChoices: [],
        }
      }
    />
  );
}

export default function PlannerScreen() {
  const { me, space, orgId } = useActiveSpace();
  const params = useLocalSearchParams<{ proposalId?: string; date?: string; groupId?: string }>();
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const [newSelection, setNewSelection] = useState<{ orgId: string; value: PlannerSelection } | null>(null);
  if (!me.data)
    return (
      <StackScreen title={m.aiPlanner.title}>
        <LoadingState />
      </StackScreen>
    );
  if (!space?.aiPlannerEnabled || !orgId)
    return (
      <StackScreen title={m.aiPlanner.title}>
        <T>{space?.aiPlannerUpgrade ? m.aiPlanner.paidOnly : m.aiPlanner.disabled}</T>
      </StackScreen>
    );
  if (params.proposalId && !uuid.safeParse(params.proposalId).success)
    return (
      <StackScreen title={m.aiPlanner.title}>
        <T>{m.common.notFound}</T>
      </StackScreen>
    );
  return (
    <PlannerLoader
      key={`${me.data.id}:${orgId}:${params.proposalId ?? "new"}:${revision}`}
      userId={me.data.id}
      orgId={orgId}
      proposalId={params.proposalId || undefined}
      date={params.date}
      groupId={params.groupId}
      revision={revision}
      newSelection={newSelection?.orgId === orgId ? newSelection.value : undefined}
      onNew={(selection) => {
        setNewSelection({ orgId, value: selection });
        router.setParams({ proposalId: "" });
        setRevision((v) => v + 1);
      }}
    />
  );
}
