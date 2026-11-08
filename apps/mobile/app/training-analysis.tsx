import { trainingAnalysisQuery } from "@tartan/contracts";
import { historyRange } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { NativeTrainingAnalysis } from "../src/features/training-analysis";
import { api } from "../src/lib/api";
import { localIsoDate } from "../src/lib/dates";
import { useActiveSpace } from "../src/lib/queries";
import { Button, Field, T } from "../src/ui/primitives";
import { StackScreen } from "../src/ui/screen";
import { ErrorState, LoadingState } from "../src/ui/states";
import { space } from "../src/ui/theme";
const t = m.analysis;
function AnalysisPanel({
  orgId,
  userId,
  role,
  initialTarget,
}: {
  orgId: string;
  userId: string;
  role: string;
  initialTarget: string;
}) {
  const [target, setTarget] = useState(initialTarget),
    [period, setPeriod] = useState("28");
  const [choosing, setChoosing] = useState(false),
    [search, setSearch] = useState("");
  const [choosingPeriod, setChoosingPeriod] = useState(false);
  const context = useQuery({
    queryKey: ["analysis-context", orgId, userId, role],
    queryFn: () => api.trainingAnalysisContext(orgId),
    staleTime: 0,
  });
  const available = !context.isError && !context.isFetching ? context.data : undefined;
  const phase = available?.phases.find((p) => period === `phase:${p.id}`);
  const [kind, id] = target.split(":");
  const parsed = trainingAnalysisQuery.safeParse({
    ...(phase
      ? { from: phase.startDate, to: phase.endDate, phaseId: phase.id }
      : ["28", "84", "365"].includes(period)
        ? historyRange(available?.today ?? localIsoDate(), Number(period) as 28 | 84 | 365)
        : { from: "", to: "" }),
    ...(kind === "athlete" ? { athleteId: id } : kind === "group" ? { groupId: id } : {}),
  });
  const data = useQuery({
    queryKey: ["training-analysis", orgId, userId, role, target, period, parsed.success ? parsed.data : null],
    queryFn: () => api.trainingAnalysis(orgId, parsed.success ? parsed.data : { from: "", to: "" }),
    enabled: Boolean(available) && parsed.success && !context.isError,
    staleTime: 0,
  });
  const targets = [
    ...(available?.groups.map((g) => ({ value: `group:${g.id}`, label: `${g.name} · ${m.trainingPhases.group}` })) ??
      []),
    ...(available?.athletes.map((a) => ({
      value: `athlete:${a.id}`,
      label: `${a.name} · ${m.trainingPhases.athlete}`,
    })) ?? []),
  ];
  const periods = [
    { value: "28", label: t.fourWeeks },
    { value: "84", label: t.twelveWeeks },
    { value: "365", label: t.year },
    ...(available?.phases.map((p) => ({ value: `phase:${p.id}`, label: `${p.targetName} : ${p.name}` })) ?? []),
  ];
  return (
    <View style={{ gap: space.md }}>
      {context.isPending || context.isFetching ? <LoadingState /> : null}
      {context.isError ? <ErrorState error={context.error} onRetry={() => void context.refetch()} /> : null}
      {available ? (
        <>
          <Button
            label={`${m.trainingPhases.target} : ${targets.find((t) => t.value === target)?.label ?? m.trainingPhases.all}`}
            variant="secondary"
            expanded={choosing}
            onPress={() => setChoosing(!choosing)}
          />
          {choosing ? (
            <>
              <Field label={m.trainingPhases.searchTarget} value={search} onChangeText={setSearch} />
              <Button
                label={m.trainingPhases.all}
                variant="secondary"
                selected={!target}
                onPress={() => {
                  setTarget("");
                  setChoosing(false);
                }}
              />
              {targets
                .filter((t) => t.label.toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr")))
                .map((t) => (
                  <Button
                    key={t.value}
                    label={t.label}
                    variant="secondary"
                    selected={t.value === target}
                    onPress={() => {
                      setTarget(t.value);
                      setChoosing(false);
                    }}
                  />
                ))}
            </>
          ) : null}
          <Button
            label={`${t.period} : ${periods.find((p) => p.value === period)?.label ?? t.fourWeeks}`}
            variant="secondary"
            expanded={choosingPeriod}
            onPress={() => setChoosingPeriod(!choosingPeriod)}
          />
          {choosingPeriod
            ? periods.map((p) => (
                <Button
                  key={p.value}
                  label={p.label}
                  variant="secondary"
                  selected={p.value === period}
                  onPress={() => {
                    setPeriod(p.value);
                    setChoosingPeriod(false);
                  }}
                />
              ))
            : null}
          {!parsed.success ? (
            <T tone="danger">{t.invalid}</T>
          ) : data.isPending || data.isFetching ? (
            <LoadingState />
          ) : null}
          {data.isError ? <ErrorState error={data.error} onRetry={() => void data.refetch()} /> : null}
          {data.data && !data.isError && !data.isFetching && parsed.success ? (
            <NativeTrainingAnalysis data={data.data} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
export default function TrainingAnalysisScreen() {
  const { orgId, space: active, me } = useActiveSpace();
  const params = useLocalSearchParams<{ target?: string }>();
  return (
    <StackScreen title={t.title} world="work">
      {!active || !me.data ? (
        <LoadingState />
      ) : !active.progressionEnabled ? (
        <T>{m.progression.disabled}</T>
      ) : (
        <AnalysisPanel
          key={`${orgId}:${me.data.id}:${active.role}`}
          orgId={orgId}
          userId={me.data.id}
          role={active.role}
          initialTarget={params.target ?? ""}
        />
      )}
    </StackScreen>
  );
}
