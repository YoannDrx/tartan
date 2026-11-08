import { useMemo, useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { ExerciseHistory } from "@tartan/contracts";
import { historyChartGeometry, strengthHistoryCurves } from "@tartan/domain";
import { historyDate, historyNumber, m, strengthCurveLabel } from "@tartan/i18n";
import { Button, Card, SectionTitle, T } from "../ui/primitives";
import { space, usePalette } from "../ui/theme";

const t = m.strengthHistory;
export function StrengthHistory({ history }: { history: ExerciseHistory }) {
  const p = usePalette();
  const curves = useMemo(() => strengthHistoryCurves(history), [history]);
  const [selected, setSelected] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [table, setTable] = useState(false);
  const [method, setMethod] = useState(false);
  const current = curves.find((curve) => curve.key === selected) ?? curves[0];
  if (!current && history.exercise.loadKind !== "external_total" && history.exercise.loadKind !== "added_weight")
    return null;
  const geometry = historyChartGeometry(current?.points ?? []);
  const known = current?.points.filter((point) => point.value !== null) ?? [];
  const tests = current?.source.startsWith("test_");
  return (
    <Card>
      <View style={{ gap: space.md }}>
        <SectionTitle>{t.title}</SectionTitle>
        {!current ? (
          <T>{t.empty}</T>
        ) : (
          <>
            <T variant="smallStrong">{strengthCurveLabel(current)}</T>
            <Button
              label={t.change}
              expanded={choosing}
              variant="secondary"
              onPress={() => setChoosing((old) => !old)}
            />
            {choosing
              ? curves.map((curve) => (
                  <Button
                    key={curve.key}
                    label={strengthCurveLabel(curve)}
                    selected={curve.key === current.key}
                    variant="secondary"
                    onPress={() => {
                      setSelected(curve.key);
                      setChoosing(false);
                    }}
                  />
                ))
              : null}
            <T accessibilityLiveRegion="polite">
              {t.summary(historyNumber(known[0]!.value!), historyNumber(known.at(-1)!.value!))}
            </T>
            <T tone="muted">{t.dates(known.length)}</T>
            {!tests && history.coverage.truncated ? <T>{m.exerciseHistory.truncated}</T> : null}
            {geometry.showChart ? (
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <T>
                  {historyNumber(geometry.max)} · {t.value}
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
                  0 · {historyDate(current.points[0]!.date)} – {historyDate(current.points.at(-1)!.date)}
                </T>
              </View>
            ) : (
              <T tone="muted">{m.exerciseHistory.chartEmpty}</T>
            )}
            <Button label={t.method} expanded={method} variant="ghost" onPress={() => setMethod((old) => !old)} />
            {method ? (
              <>
                <T>{t.commonHint}</T>
                <T>
                  {current.source === "work_epley"
                    ? t.estimateHint
                    : current.source === "work_load"
                      ? t.loadHint
                      : t.testHint}
                </T>
                <T>{tests ? t.testScope : m.exerciseHistory.scope}</T>
              </>
            ) : null}
            <Button label={t.table} expanded={table} variant="secondary" onPress={() => setTable((old) => !old)} />
            {table
              ? current.points.map((point) => (
                  <View key={point.date} accessible style={{ gap: space.xs }}>
                    <T variant="smallStrong">
                      {historyDate(point.date)} ·{" "}
                      {point.value === null ? m.exerciseHistory.missing : `${historyNumber(point.value)} kg`}
                    </T>
                    <T>
                      {tests ? t.coverageTests : t.coverageWork} :{" "}
                      {m.exerciseHistory.coverageValue(point.knownSessions, point.sessions)}
                    </T>
                  </View>
                ))
              : null}
          </>
        )}
      </View>
    </Card>
  );
}
