import { phasePlanningQuery, type PhasePlanningQuery } from "@tartan/contracts";
import { phasePlanningKey, type PhasePlanningReadiness } from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { api } from "../lib/api";
import { useActiveSpace } from "../lib/queries";
import { Button, SectionTitle, T } from "../ui/primitives";
import { ErrorState, LoadingState } from "../ui/states";
import { space } from "../ui/theme";

const t = m.trainingPhases;
export function NativePhasePlanning({
  orgId,
  date,
  groupIds,
  athleteIds,
  onReady,
}: {
  orgId: string;
  date: string;
  groupIds: string[];
  athleteIds: string[];
  onReady: (state: PhasePlanningReadiness) => void;
}) {
  const { me, space: active } = useActiveSpace();
  const key = phasePlanningKey(date, groupIds, athleteIds);
  const [choices, setChoices] = useState<PhasePlanningQuery["choices"]>([]);
  const [expanded, setExpanded] = useState(false);
  const parsed = phasePlanningQuery.safeParse({ date, groupIds, athleteIds, choices });
  const hasAudience = groupIds.length + athleteIds.length > 0;
  const data = useQuery({
    queryKey: ["phase-planning", orgId, me.data?.id, active?.role, key, choices],
    queryFn: () => api.phasePlanning(orgId, { date, groupIds, athleteIds, choices }),
    enabled: parsed.success && hasAudience && Boolean(active?.phasesEnabled),
    staleTime: 0,
  });
  const current = !data.isError && !data.isFetching ? data.data : undefined;
  const ready = !hasAudience || Boolean(current && current.athletes.every((a) => a.result.kind !== "choose_group"));
  useEffect(() => {
    onReady({ key, ready });
  }, [key, ready, onReady]);
  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle>{t.planning}</SectionTitle>
      <T tone="muted">{t.planningHint}</T>
      {!hasAudience ? (
        <T>{t.noAudience}</T>
      ) : !parsed.success ? (
        <T>{t.invalid}</T>
      ) : data.isPending || data.isFetching ? (
        <LoadingState />
      ) : null}
      {data.isError ? (
        <ErrorState
          error={data.error}
          onRetry={() => {
            setChoices([]);
            void data.refetch();
          }}
        />
      ) : null}
      {current ? (
        <>
          {current.groups.map((g) =>
            g.phase ? (
              <View key={g.id} style={{ gap: space.xs }}>
                <T variant="smallStrong">
                  {g.name} : {g.phase.name}
                </T>
                <T tone="muted">
                  {t.kinds[g.phase.kind]} · {historyDate(g.phase.startDate)} – {historyDate(g.phase.endDate)}
                </T>
                {g.phase.objective ? <T>{g.phase.objective}</T> : null}
              </View>
            ) : null,
          )}
          {current.athletes.some((a) => a.result.kind === "choose_group") ? (
            <T accessibilityLiveRegion="polite">{t.chooseGroup}</T>
          ) : null}
          {current.athletes.map((a) =>
            a.result.kind === "choose_group" ? (
              <View key={a.id} style={{ gap: space.sm }}>
                <T variant="smallStrong">{t.referenceFor(a.name)}</T>
                {a.result.phases.map((phase) => (
                  <Button
                    key={phase.id}
                    variant="secondary"
                    label={`${phase.targetName} : ${phase.name}`}
                    onPress={() =>
                      setChoices((old) => [
                        ...old.filter((c) => c.athleteId !== a.id),
                        { athleteId: a.id, groupId: phase.target.id },
                      ])
                    }
                  />
                ))}
              </View>
            ) : null,
          )}
          <Button
            variant="secondary"
            label={t.planningAthletes(current.athletes.filter((a) => a.result.kind === "phase").length)}
            expanded={expanded}
            onPress={() => setExpanded(!expanded)}
          />
          {expanded
            ? current.athletes.map((a) =>
                a.result.kind === "phase" ? (
                  <View key={a.id} style={{ gap: space.xs }}>
                    <T variant="smallStrong">
                      {a.name} : {a.result.phase.name}
                    </T>
                    {a.result.phase.target.type === "athlete" ? <T tone="muted">{t.individualPriority}</T> : null}
                    {a.result.phase.objective ? <T>{a.result.phase.objective}</T> : null}
                  </View>
                ) : null,
              )
            : null}
          {!current.groups.some((g) => g.phase) && !current.athletes.some((a) => a.result.kind !== "none") ? (
            <T>{t.noPlanning}</T>
          ) : null}
          <Button
            variant="secondary"
            label={t.retryPlanning}
            onPress={() => {
              setChoices([]);
              void data.refetch();
            }}
          />
        </>
      ) : null}
    </View>
  );
}
