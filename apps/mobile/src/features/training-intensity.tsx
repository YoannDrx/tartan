import type { TrainingAnalysis, IntensityMetric, IntensitySummary } from "@tartan/contracts";
import { emptyIntensitySummary, intensityComparisonRows, intensityMetrics } from "@tartan/domain";
import { historyNumber, m } from "@tartan/i18n";
import { useState } from "react";
import { View } from "react-native";
import { Card, Button, SectionTitle, T } from "../ui/primitives";
import { space } from "../ui/theme";
const t = m.intensityAnalysis;
function Observation({ label, data }: { label: string; data: IntensitySummary }) {
  return (
    <View style={{ gap: space.xs }}>
      <T variant="smallStrong">{label}</T>
      <T>
        {data.mean === null
          ? m.analysis.missing
          : t.values(historyNumber(data.mean), historyNumber(data.min!), historyNumber(data.max!))}
      </T>
      <T tone="muted">{t.observations(data.count, data.eligible)}</T>
    </View>
  );
}
export function NativeTrainingIntensity({ data }: { data: NonNullable<TrainingAnalysis["intensity"]> }) {
  const [metric, setMetric] = useState<IntensityMetric>("kg");
  const [choosing, setChoosing] = useState(false),
    [method, setMethod] = useState(false);
  const rows = intensityComparisonRows(data, metric);
  return (
    <Card>
      <View style={{ gap: space.md }}>
        <SectionTitle>{t.title}</SectionTitle>
        <Button
          label={`${t.chooseMetric} : ${t.units[metric]}`}
          variant="secondary"
          expanded={choosing}
          onPress={() => setChoosing(!choosing)}
        />
        {choosing
          ? intensityMetrics.map((key) => (
              <Button
                key={key}
                label={t.units[key]}
                variant="secondary"
                selected={key === metric}
                onPress={() => {
                  setMetric(key);
                  setChoosing(false);
                }}
              />
            ))
          : null}
        <Button label={t.method} variant="secondary" expanded={method} onPress={() => setMethod(!method)} />
        {method ? (
          <>
            <T tone="muted">{t.hint}</T>
            <T tone="muted">{t.means}</T>
            <T tone="muted">{t.reference}</T>
            <T tone="muted">{t.targets}</T>
            <T tone="muted">
              {t.current} : {t.omitted(data.current.unlinkedItems, data.current.unmatchedWorkSets)}
            </T>
            <T tone="muted">
              {t.previous} : {t.omitted(data.previous.unlinkedItems, data.previous.unmatchedWorkSets)}
            </T>
          </>
        ) : null}
        {!rows.length ? (
          <T>{t.empty}</T>
        ) : (
          rows.map(({ row, current, previous }) => (
            <View key={row.key} style={{ gap: space.sm }}>
              <T variant="smallStrong">
                {row.name} · {row.loadKind ? m.strength.conventions[row.loadKind] : m.strength.unknownConvention}
              </T>
              {(
                [
                  [t.current, current],
                  [t.previous, previous],
                ] as const
              ).map(([label, period]) => (
                <View key={label} style={{ gap: space.sm }}>
                  <T variant="smallStrong">{label}</T>
                  <Observation label={t.planned} data={period?.planned ?? emptyIntensitySummary()} />
                  {row.actual !== null ? (
                    <Observation label={t.actual} data={period?.actual ?? emptyIntensitySummary()} />
                  ) : null}
                </View>
              ))}
            </View>
          ))
        )}
      </View>
    </Card>
  );
}
