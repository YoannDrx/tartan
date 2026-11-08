import { addDays, formatHeight } from "@tartan/domain";
import { capitalize, formatDayMonth, m, strengthTestLabel } from "@tartan/i18n";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useActiveSpace, useAthleteFile } from "../../src/lib/queries";
import { Button, Divider, ListSurface, SectionTitle, T, Tag } from "../../src/ui/primitives";
import { TabScreen } from "../../src/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";
import { NativeCalendarPhases } from "../../src/features/training-phases";
import { localIsoDate } from "../../src/lib/dates";

const markLabel = (mark: number, unit: string) => {
  if (unit === "cm") return `${formatHeight(mark)} m`;
  return `${String(mark).replace(".", ",")} ${unit}`;
};

const disciplineLabel = (key: string) => (m.mobile.progress.discipline as Record<string, string>)[key] ?? key;
const testKind = (kind: string) => (m.testKind as Record<string, string>)[kind] ?? kind;

// Les séries et courbes sont accessibles avec le flag progression.
export default function Progress() {
  const { orgId, space: active } = useActiveSpace();
  const router = useRouter();
  const today = localIsoDate();
  const file = useAthleteFile(orgId);
  const empty = file.data && file.data.performances.length === 0 && file.data.tests.length === 0;
  return (
    <TabScreen
      world="work"
      title={m.mobile.progress.title}
      refreshing={file.isRefetching}
      onRefresh={() => void file.refetch()}
    >
      {file.isPending ? <LoadingState /> : null}
      {file.isError && !file.data ? <ErrorState error={file.error} onRetry={() => void file.refetch()} /> : null}
      {active?.progressionEnabled ? (
        <>
          <Button label={m.analysis.title} variant="secondary" onPress={() => router.push("/training-analysis")} />
          <Button label={m.calculator.title} variant="secondary" onPress={() => router.push("/load-calculator")} />
          {file.data && !file.isError ? (
            <Button
              label={m.exerciseHistory.title}
              variant="secondary"
              onPress={() => router.push(`/exercise-history/${file.data.id}`)}
            />
          ) : null}
        </>
      ) : null}
      <NativeCalendarPhases from={today} to={addDays(today, 83)} />
      {empty ? <EmptyState body={m.mobile.progress.empty} /> : null}
      {file.data && file.data.performances.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <SectionTitle>{m.performances.title}</SectionTitle>
          <ListSurface>
            {file.data.performances.map((perf, i) => (
              <View key={`${perf.discipline}-${perf.date}-${i}`}>
                {i > 0 ? <Divider /> : null}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.md,
                    padding: space.md,
                    minHeight: 60,
                  }}
                  accessible
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="smallStrong">{disciplineLabel(perf.discipline)}</T>
                    <T variant="caption" tone="muted">
                      {[
                        capitalize(formatDayMonth(perf.date)),
                        perf.location,
                        perf.comparisonContext,
                        perf.recordDirection === "lower"
                          ? m.performances.lower
                          : perf.recordDirection === "higher"
                            ? m.performances.higher
                            : m.performances.unknown,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </T>
                    {perf.isBaseline ? (
                      <Tag label={m.performances.baseline} />
                    ) : perf.isPb ? (
                      <Tag label={m.mobile.progress.personalBest} tone="brand" />
                    ) : null}
                  </View>
                  <T variant="figure" style={{ fontSize: 24, lineHeight: 28 }}>
                    {markLabel(perf.mark, perf.unit)}
                  </T>
                </View>
              </View>
            ))}
          </ListSurface>
        </View>
      ) : null}
      {file.data && file.data.tests.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <SectionTitle>{m.mobile.progress.tests}</SectionTitle>
          <ListSurface>
            {file.data.tests.map((test, i) => (
              <View key={`${test.exerciseKey}-${test.date}-${i}`}>
                {i > 0 ? <Divider /> : null}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.md,
                    padding: space.md,
                    minHeight: 60,
                  }}
                  accessible
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="smallStrong">{test.exerciseName ?? strengthTestLabel(test.exerciseKey)}</T>
                    <T variant="caption" tone="muted">
                      {`${testKind(test.kind)} · ${capitalize(formatDayMonth(test.date))}`}
                    </T>
                  </View>
                  <T variant="figure" style={{ fontSize: 24, lineHeight: 28 }}>
                    {`${String(test.value).replace(".", ",")} kg`}
                  </T>
                </View>
              </View>
            ))}
          </ListSurface>
        </View>
      ) : null}
    </TabScreen>
  );
}
