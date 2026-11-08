import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { isoDate, uuid, type ExerciseHistory } from "@tartan/contracts";
import {
  formatPrescription,
  historyChartGeometry,
  historyPeriods,
  historyRange,
  historyVolumePoints,
  volumeMetrics,
  type HistoryPeriod,
  type VolumeMetric,
} from "@tartan/domain";
import { historyDate, historyNumber, m, realizedSetLabel } from "@tartan/i18n";
import { api } from "../../src/lib/api";
import { useActiveSpace } from "../../src/lib/queries";
import { Button, Card, Field, SectionTitle, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { space, usePalette } from "../../src/ui/theme";
import { StrengthRecords } from "../../src/features/strength-records";
import { StrengthHistory } from "../../src/features/strength-history";
import { StrengthCalculator } from "../../src/features/strength-calculator";

const t = m.exerciseHistory;
function HistoryDetail({ history }: { history: ExerciseHistory }) {
  const [metric, setMetric] = useState<VolumeMetric>("tonnageKg");
  const [showTable, setShowTable] = useState(false);
  const [showTests, setShowTests] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);
  const p = usePalette();
  const points = historyVolumePoints(history.sessions, metric);
  const geometry = historyChartGeometry(points);
  const known = points.filter((point) => point.value !== null);
  return (
    <>
      <T>
        {history.exercise.name}
        {history.exercise.archived ? ` · ${t.archived}` : ""}
      </T>
      <T tone="muted">
        {historyDate(history.from)} – {historyDate(history.to)}
      </T>
      <Card>
        <View style={{ gap: space.sm }}>
          <SectionTitle>{m.strength.currentReference}</SectionTitle>
          {history.reference ? (
            <>
              <T variant="figure">
                {historyNumber(history.reference.valueKg)} kg · {m.strength.referenceKinds[history.reference.kind]}
              </T>
              <T tone="muted">{t.selectedOn(historyDate(history.reference.selectedAt))}</T>
            </>
          ) : (
            <T>{m.strength.noReference}</T>
          )}
          <T>
            {m.strength.conventions[history.exercise.loadKind as keyof typeof m.strength.conventions] ??
              m.strength.unknownConvention}
          </T>
          {history.tests.length ? (
            <>
              <SectionTitle>{t.tests}</SectionTitle>
              <Button
                label={t.viewTests(history.tests.length)}
                expanded={showTests}
                variant="ghost"
                onPress={() => setShowTests((old) => !old)}
              />
              {showTests
                ? history.tests.map((test) => (
                    <T key={test.id}>
                      {historyDate(test.date)} · {historyNumber(test.value)} kg ·{" "}
                      {m.testKind[test.kind as keyof typeof m.testKind] ?? test.kind}
                    </T>
                  ))
                : null}
            </>
          ) : null}
        </View>
      </Card>
      <StrengthHistory history={history} />
      <StrengthRecords records={history.records} />
      <SectionTitle>{t.volumes}</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {volumeMetrics.map((key) => (
          <Button
            key={key}
            compact
            label={t.metrics[key]}
            selected={metric === key}
            variant={metric === key ? "primary" : "secondary"}
            onPress={() => setMetric(key)}
          />
        ))}
      </View>
      <T>{t.coverage(history.coverage.returnedSessions, history.coverage.totalSessions)}</T>
      {history.coverage.truncated ? <T>{t.truncated}</T> : null}
      {history.coverage.unusableSets ? <T>{t.unusable(history.coverage.unusableSets)}</T> : null}
      <T accessibilityLiveRegion="polite">
        {known.length
          ? t.summary(known.length, historyNumber(known.reduce((total, point) => total + point.value!, 0)))
          : t.noMeasurements}
      </T>
      {geometry.showChart ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <T>
            {historyNumber(geometry.max)} · {t.metrics[metric]}
          </T>
          <Svg viewBox="0 0 600 200" width="100%" height={200} accessible={false}>
            <Path d="M20,20V180H580" stroke={p.border} fill="none" />
            <Path d={geometry.path} stroke={p.text} strokeWidth={2} fill="none" />
            {geometry.dots
              .filter((point) => point.y !== null)
              .map((point) => (
                <Circle key={point.date} cx={point.x} cy={point.y!} r={4} fill={p.text} />
              ))}
          </Svg>
          <T>
            0 · {historyDate(points[0]!.date)} – {historyDate(points.at(-1)!.date)}
          </T>
        </View>
      ) : (
        <T tone="muted">{t.chartEmpty}</T>
      )}
      <Button label={t.method} variant="ghost" expanded={showMethod} onPress={() => setShowMethod((old) => !old)} />
      {showMethod ? (
        <>
          <T>{t.chartHint}</T>
          <T tone="muted">{t.scope}</T>
        </>
      ) : null}
      <Button
        label={t.table}
        selected={showTable}
        variant="secondary"
        expanded={showTable}
        onPress={() => setShowTable((old) => !old)}
      />
      {showTable ? (
        <View style={{ gap: space.md }}>
          {points.map((point) => (
            <View key={point.date} accessible style={{ gap: space.xs }}>
              <T variant="smallStrong">
                {historyDate(point.date)} · {point.value === null ? t.missing : historyNumber(point.value)}
              </T>
              <T>
                {t.metrics[metric]} · {t.coverageColumn} : {t.coverageValue(point.knownSessions, point.sessions)}
              </T>
            </View>
          ))}
        </View>
      ) : null}
      <SectionTitle>{t.sessions}</SectionTitle>
      {!history.sessions.length ? <T>{t.noSessions}</T> : null}
      {history.sessions.slice(0, limit).map((session) => (
        <View key={session.logId} style={{ gap: space.md }}>
          <Button
            label={`${historyDate(session.date)} · ${session.title}`}
            variant="secondary"
            expanded={expanded === session.logId}
            onPress={() => setExpanded((old) => (old === session.logId ? null : session.logId))}
          />
          {expanded === session.logId ? (
            <Card>
              <View style={{ gap: space.md }}>
                <T tone="muted">
                  {t.updatedOn(historyDate(session.updatedAt))} · {m.progression[session.status]}
                </T>
                {session.items.map((item) => (
                  <View key={item.itemRef} style={{ gap: space.sm }}>
                    <T heading variant="title2">
                      {item.name}
                    </T>
                    <T>
                      {t.prescribed} : {formatPrescription(item.prescription, item.resolvedLoadKg)}
                    </T>
                    <T variant="smallStrong">{t.realized}</T>
                    {item.sets.length ? (
                      item.sets.map((set) => (
                        <T key={set.setIndex}>
                          {m.progression.setNumber(set.setIndex + 1)} · {realizedSetLabel(set, item.strengthLoadKind)}
                        </T>
                      ))
                    ) : (
                      <T>{t.missing}</T>
                    )}
                  </View>
                ))}
              </View>
            </Card>
          ) : null}
        </View>
      ))}
      {history.sessions.length > limit ? (
        <Button label={t.more} variant="secondary" onPress={() => setLimit((old) => old + 10)} />
      ) : null}
      {history.exercise.loadKind === "external_total" ? (
        <>
          <Button
            label={t.calculator}
            variant="secondary"
            expanded={showCalculator}
            onPress={() => setShowCalculator((old) => !old)}
          />
          {showCalculator ? (
            <StrengthCalculator
              key={`${history.exercise.id}:${history.reference?.id}:${history.reference?.valueKg}`}
              referenceKg={history.reference?.valueKg}
              stepKg={history.exercise.stepKg}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}

function HistoryScreen({
  orgId,
  athleteId,
  initialExercise,
  initialDays,
  initialUntil,
}: {
  orgId: string;
  athleteId: string;
  initialExercise?: string;
  initialDays?: string;
  initialUntil?: string;
}) {
  const [selected, setSelected] = useState<string | null>(initialExercise ?? null);
  const [days, setDays] = useState<HistoryPeriod>(initialDays === "365" ? 365 : initialDays === "84" ? 84 : 28);
  const [until, setUntil] = useState<string | undefined>(initialUntil);
  const [search, setSearch] = useState("");
  const [choosing, setChoosing] = useState(false);
  const context = useQuery({
    queryKey: ["exercise-history-context", orgId, athleteId],
    queryFn: () => api.athleteHistoryContext(orgId, athleteId),
  });
  const exerciseId = selected ?? context.data?.exercises[0]?.id;
  const history = useQuery({
    queryKey: ["exercise-history", orgId, athleteId, exerciseId, days, until ?? context.data?.today],
    queryFn: () =>
      api.athleteExerciseHistory(orgId, athleteId, exerciseId!, historyRange(until ?? context.data!.today, days)),
    enabled: Boolean(context.data && !context.isError && exerciseId),
  });
  const name = context.data ? `${context.data.athlete.firstName} ${context.data.athlete.lastName}` : undefined;
  return (
    <StackScreen world="work" title={t.title} subtitle={context.isError ? undefined : name}>
      {context.isPending ? (
        <LoadingState />
      ) : context.isError ? (
        <ErrorState error={context.error} onRetry={() => void context.refetch()} />
      ) : (
        <>
          <T tone="muted">{t.intro}</T>
          <Button
            label={t.refresh}
            variant="ghost"
            loading={context.isRefetching || history.isRefetching}
            onPress={() => {
              void context.refetch();
              if (exerciseId) void history.refetch();
            }}
          />
          {!context.data.exercises.length && !exerciseId ? (
            <T>{t.empty}</T>
          ) : (
            <>
              <Button
                label={m.strength.changeExercise}
                variant="secondary"
                expanded={choosing}
                onPress={() => setChoosing((old) => !old)}
              />
              {choosing ? (
                <>
                  <Field label={t.exercise} value={search} onChangeText={setSearch} />
                  {context.data.exercises
                    .filter((exercise) =>
                      exercise.name.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")),
                    )
                    .map((exercise) => (
                      <Button
                        key={exercise.id}
                        label={`${exercise.name}${exercise.archived ? ` · ${t.archived}` : ""}`}
                        variant="secondary"
                        selected={exercise.id === exerciseId}
                        onPress={() => {
                          setSelected(exercise.id);
                          setChoosing(false);
                          setSearch("");
                        }}
                      />
                    ))}
                </>
              ) : null}
              {until && until !== context.data.today ? (
                <Button label={t.untilToday} variant="secondary" onPress={() => setUntil(undefined)} />
              ) : null}
              <T variant="smallStrong">{t.period}</T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {historyPeriods.map((period) => (
                  <Button
                    key={period}
                    compact
                    label={t.periods[period]}
                    selected={days === period}
                    variant={days === period ? "primary" : "secondary"}
                    onPress={() => setDays(period)}
                  />
                ))}
              </View>
              {history.isPending ? (
                <LoadingState />
              ) : history.isError ? (
                <ErrorState error={history.error} onRetry={() => void history.refetch()} />
              ) : (
                <HistoryDetail key={`${exerciseId}:${days}:${until}`} history={history.data} />
              )}
            </>
          )}
        </>
      )}
    </StackScreen>
  );
}
export default function ExerciseHistoryScreen() {
  const { athleteId, exercise, days, to } = useLocalSearchParams<{
    athleteId: string;
    exercise?: string;
    days?: string;
    to?: string;
  }>();
  const { orgId, space: active, me } = useActiveSpace();
  if (me.isPending)
    return (
      <StackScreen title={t.title}>
        <LoadingState />
      </StackScreen>
    );
  if (me.isError)
    return (
      <StackScreen title={t.title}>
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </StackScreen>
    );
  if (
    !active?.progressionEnabled ||
    !uuid.safeParse(athleteId).success ||
    (exercise !== undefined && !uuid.safeParse(exercise).success) ||
    (to !== undefined && !isoDate.safeParse(to).success)
  )
    return (
      <StackScreen title={t.title}>
        <T>{active?.progressionEnabled ? m.common.forbidden : m.progression.disabled}</T>
      </StackScreen>
    );
  return (
    <HistoryScreen
      key={`${me.data?.id}:${orgId}:${athleteId}:${exercise}:${days}:${to}`}
      orgId={orgId}
      athleteId={athleteId}
      initialExercise={exercise}
      initialDays={days}
      initialUntil={to}
    />
  );
}
