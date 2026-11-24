import { m } from "@tartan/i18n";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { errorMessage } from "../src/lib/errors";
import { api } from "../src/lib/api";
import { useActiveSpace } from "../src/lib/queries";
import { Button, T } from "../src/ui/primitives";
import { StackScreen } from "../src/ui/screen";
import { ErrorState, LoadingState } from "../src/ui/states";
import { space } from "../src/ui/theme";

const t = m.aiPlanner;
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" });

function ProposalList({ orgId, userId }: { orgId: string; userId: string }) {
  const [cursors, setCursors] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "created">("all");
  const [failure, setFailure] = useState("");
  const before = cursors.at(-1);
  const router = useRouter();
  const proposals = useQuery({
    queryKey: ["planner-proposals", orgId, userId, filter, before ?? "first"],
    queryFn: ({ signal }) => api.plannerProposals(orgId, { before, filter }, signal),
    // Contenu privé uniquement en mémoire ; chaque ouverture recontrôle l'accès.
    gcTime: 0,
    staleTime: 0,
    retry: false,
    networkMode: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return (
    <StackScreen title={t.recent}>
      <T>{t.recentHint}</T>
      <T variant="small" tone="muted">
        {t.recentRetention}
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
        {(["pending", "created", "all"] as const).map((value) => (
          <Button
            key={value}
            label={t.historyFilters[value]}
            variant={filter === value ? "primary" : "secondary"}
            onPress={() => {
              setCursors([]);
              setFilter(value);
              setFailure("");
            }}
          />
        ))}
      </View>
      {failure ? <T accessibilityLiveRegion="polite">{failure}</T> : null}
      {proposals.isPending ? (
        <LoadingState inline />
      ) : proposals.isError ? (
        <ErrorState
          error={proposals.error}
          onRetry={() => {
            void proposals.refetch();
          }}
        />
      ) : (
        <>
          {!proposals.data.items.length ? <T>{t.recentEmpty}</T> : null}
          {proposals.data.items.map((proposal) => (
            <View key={proposal.id} style={{ gap: space.sm }}>
              <Button
                variant="secondary"
                label={
                  t.historyActions[proposal.state] +
                  " · " +
                  t.recentOpen(
                    dateLabel(proposal.period.from),
                    dateLabel(proposal.period.to),
                    t.recentStates[proposal.state],
                  )
                }
                onPress={() => router.replace({ pathname: "/planner", params: { proposalId: proposal.id } })}
              />
              {proposal.version !== undefined && proposal.state !== "processing" ? (
                <Button
                  variant="ghost"
                  label={t.removeProposal}
                  onPress={() => {
                    const version = proposal.version;
                    if (version === undefined) return;
                    Alert.alert(
                      t.removeProposal,
                      t.removeProposalDetail(
                        t.recentOpen(
                          dateLabel(proposal.period.from),
                          dateLabel(proposal.period.to),
                          t.recentStates[proposal.state],
                        ),
                      ),
                      [
                        { text: m.common.cancel, style: "cancel" },
                        {
                          text: t.removeProposal,
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await api.removePlannerProposal(orgId, proposal.id, version);
                              setFailure("");
                              await proposals.refetch();
                            } catch (error) {
                              setFailure(errorMessage(error));
                            }
                          },
                        },
                      ],
                    );
                  }}
                />
              ) : null}
              <T variant="small" tone="muted">
                {t.recentCreated(new Date(proposal.createdAt).toLocaleString("fr-FR"))}
              </T>
            </View>
          ))}
          {proposals.data.nextCursor ? (
            <Button
              variant="secondary"
              label={t.recentEarlier}
              onPress={() => setCursors((current) => [...current, proposals.data.nextCursor!])}
            />
          ) : null}
          <Button
            variant="secondary"
            label={t.recentRefresh}
            disabled={proposals.isFetching}
            onPress={() => {
              void proposals.refetch();
            }}
          />
        </>
      )}
      {cursors.length ? (
        <Button
          variant="secondary"
          label={t.recentNewer}
          onPress={() => setCursors((current) => current.slice(0, -1))}
        />
      ) : null}
    </StackScreen>
  );
}

export default function PlannerProposalsScreen() {
  const { me, space: activeSpace, orgId } = useActiveSpace();
  if (!me.data)
    return (
      <StackScreen title={t.recent}>
        <LoadingState />
      </StackScreen>
    );
  if (!activeSpace?.aiPlannerEnabled || !orgId)
    return (
      <StackScreen title={t.recent}>
        <T>{t.disabled}</T>
      </StackScreen>
    );
  return <ProposalList key={`${me.data.id}:${orgId}`} orgId={orgId} userId={me.data.id} />;
}
