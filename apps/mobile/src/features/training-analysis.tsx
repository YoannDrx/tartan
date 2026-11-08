import { NativeTrainingIntensity } from "./training-intensity";
import type { TrainingAnalysis } from "@tartan/contracts";
import {
  analysisChartPoints,
  analysisPerceivedLoadPoints,
  analysisVolumeKeys,
  historyChartGeometry,
} from "@tartan/domain";
import { historyDate, historyNumber, exerciseClassificationLabel, m } from "@tartan/i18n";
import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Button, Card, SectionTitle, T } from "../ui/primitives";
import { space, usePalette } from "../ui/theme";
const t = m.analysis;
const value = (n: number | null) => (n === null ? t.missing : historyNumber(n));
export function NativeTrainingAnalysis({ data }: { data: TrainingAnalysis }) {
  const palette = usePalette();
  const [method, setMethod] = useState(false);
  const [metric, setMetric] = useState<(typeof analysisVolumeKeys)[number]>("tonnageKg");
  const [choosing, setChoosing] = useState(false),
    [table, setTable] = useState(false),
    [exercises, setExercises] = useState(false);
  const planned = analysisChartPoints(data, metric, "planned"),
    actual = analysisChartPoints(data, metric, "actual");
  const max = Math.max(1, ...[...planned, ...actual].map((p) => p.value ?? 0));
  const p = historyChartGeometry(planned, max),
    a = historyChartGeometry(actual, max);
  const [healthTable, setHealthTable] = useState(false);
  const [healthMethod, setHealthMethod] = useState(false);
  const [classificationSection, setClassificationSection] = useState<"movements" | "equipment" | null>(null);
  const [phaseMethod, setPhaseMethod] = useState(false);
  const healthPoints = analysisPerceivedLoadPoints(data);
  const health = historyChartGeometry(healthPoints);
  return (
    <View style={{ gap: space.md }}>
      {data.phase ? (
        <View style={{ gap: space.sm }}>
          <T>
            {data.phase.name} — {data.phase.basis === "prescription" ? t.phaseStored : t.phasePublic}
          </T>
          {data.phase.coverage ? (
            <T tone="muted">
              {t.phaseCoverage(
                data.phase.coverage.matched,
                data.phase.coverage.withoutReference,
                data.phase.coverage.otherPhase,
              )}
            </T>
          ) : null}
          <Button
            label={t.phaseMethod}
            variant="secondary"
            expanded={phaseMethod}
            onPress={() => setPhaseMethod(!phaseMethod)}
          />
          {phaseMethod ? (
            <>
              <T tone="muted">{data.phase.basis === "prescription" ? t.phaseAttributedScope : t.phaseScope}</T>
              {data.phase.basis === "prescription" ? <T tone="muted">{t.phasePriorScope}</T> : null}
            </>
          ) : null}
        </View>
      ) : null}
      <Card>
        <View style={{ gap: space.sm }}>
          <SectionTitle>{t.volumes}</SectionTitle>
          <T>
            {t.sessions} : {data.totals.assignedSessions}
          </T>
          <T>
            {t.completed} : {data.totals.completedSessions}
          </T>
          <T>
            {t.details} : {data.totals.detailedSessions} / {data.totals.completedSessions}
          </T>
          <T>
            {t.frozen} : {data.totals.frozenSessions} / {data.totals.assignedSessions}
          </T>
          <T>
            {t.prescribedSets} : {data.totals.plannedSets}
          </T>
          <T>
            {t.workSets} : {data.totals.completedWorkSets}
          </T>
          <T>
            {t.responseRate} : {data.totals.loggedSessions} / {data.totals.assignedSessions}
          </T>
          <Button label={t.method} variant="secondary" expanded={method} onPress={() => setMethod(!method)} />
          {method ? (
            <>
              <T tone="muted">{t.scope}</T>
              <T tone="muted">{t.noSubstitution}</T>
              <T tone="muted">{t.historical}</T>
              <T tone="muted">{t.partialWeeks}</T>
            </>
          ) : null}
        </View>
      </Card>
      <Card>
        <View style={{ gap: space.sm }}>
          <SectionTitle>{t.weekly}</SectionTitle>
          <Button
            variant="secondary"
            label={t.metrics[metric]}
            expanded={choosing}
            onPress={() => setChoosing(!choosing)}
          />
          {choosing
            ? analysisVolumeKeys.map((key) => (
                <Button
                  key={key}
                  variant="secondary"
                  label={t.metrics[key]}
                  selected={key === metric}
                  onPress={() => {
                    setMetric(key);
                    setChoosing(false);
                  }}
                />
              ))
            : null}
          <T variant="smallStrong">
            {t.planned} : {value(data.totals.planned[metric])}
          </T>
          <T tone="muted">
            {t.plannedCoverage} : {data.totals.plannedKnownItems[metric]} / {data.totals.plannedItems}
          </T>
          <T variant="smallStrong">
            {t.actual} : {value(data.totals.actual[metric])}
          </T>
          <T tone="muted">
            {t.actualCoverage} : {data.totals.actualKnownSets[metric]} / {data.totals.completedWorkSets}
          </T>
          {p.showChart || a.showChart ? (
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <T>
                {historyNumber(max)} · {t.metrics[metric]}
              </T>
              <Svg viewBox="0 0 600 200" width="100%" height={200} accessible={false}>
                <Path d="M20,20V180H580" stroke={palette.border} fill="none" />
                <Path d={p.path} stroke={palette.text} strokeDasharray="6 5" strokeWidth={2} fill="none" />
                <Path d={a.path} stroke={palette.text} strokeWidth={3} fill="none" />
                {a.dots
                  .filter((d) => d.y !== null)
                  .map((d) => (
                    <Circle key={d.date} cx={d.x} cy={d.y!} r={4} fill={palette.text} />
                  ))}
              </Svg>
              <T>
                0 · {historyDate(data.weeks[0]?.weekStart ?? data.from)} –{" "}
                {historyDate(data.weeks.at(-1)?.weekStart ?? data.to)}
              </T>
              <T>
                {t.planned} · {t.dashed} / {t.actual} · {t.solid}
              </T>
            </View>
          ) : (
            <T tone="muted">{m.exerciseHistory.chartEmpty}</T>
          )}
          <Button label={t.table} variant="secondary" expanded={table} onPress={() => setTable(!table)} />
          {table
            ? data.weeks.map((w) => (
                <View key={w.weekStart} style={{ gap: space.xs }} accessible>
                  <T variant="smallStrong">
                    {t.week} : {historyDate(w.weekStart)}
                  </T>
                  <T>
                    {t.planned} : {value(w.totals.planned[metric])} · {t.actual} : {value(w.totals.actual[metric])}
                  </T>
                </View>
              ))
            : null}
          <SectionTitle>{t.prior}</SectionTitle>
          <T>
            {historyDate(data.previousFrom)} – {historyDate(data.previousTo)}
          </T>
          <T>
            {t.planned} : {value(data.previous.planned[metric])} · {t.actual} : {value(data.previous.actual[metric])}
          </T>
          <T tone="muted">
            {t.actualCoverage} : {data.previous.actualKnownSets[metric]} / {data.previous.completedWorkSets} ·{" "}
            {t.details} : {data.previous.detailedSessions} / {data.previous.completedSessions}
          </T>
        </View>
      </Card>
      <Card>
        <View style={{ gap: space.sm }}>
          <SectionTitle>{t.diversity}</SectionTitle>
          <T>
            {historyDate(data.diversity28Days.from)} – {historyDate(data.diversity28Days.to)}
          </T>
          <T>
            {t.distinct} : {data.diversity28Days.distinctExercises}
          </T>
          <T>
            {t.occurrences} : {data.diversity28Days.occurrences}
          </T>
          <T tone="muted">{t.diversityHint}</T>
        </View>
      </Card>
      <Card>
        <View style={{ gap: space.sm }}>
          <SectionTitle>{t.distribution}</SectionTitle>
          {data.categories.map((row) => (
            <View key={row.category}>
              <T variant="smallStrong">
                {(m.exerciseCategory as Record<string, string>)[row.category] ?? row.category}
              </T>
              <T>
                {t.prescribedSets} : {row.plannedSets} · {t.workSets} : {row.completedWorkSets}
              </T>
            </View>
          ))}
          <Button
            label={t.exercise}
            variant="secondary"
            expanded={exercises}
            onPress={() => setExercises(!exercises)}
          />
          {exercises
            ? data.exercises.map((row) => (
                <View key={row.key}>
                  <T variant="smallStrong">{row.name}</T>
                  <T>
                    {t.occurrences} : {row.occurrences} · {t.prescribedSets} : {row.plannedSets} · {t.workSets} :{" "}
                    {row.completedWorkSets}
                  </T>
                </View>
              ))
            : null}
        </View>
      </Card>
      {data.classification ? (
        <Card>
          <View style={{ gap: space.sm }}>
            <SectionTitle>{m.exerciseClassification.title}</SectionTitle>
            <T tone="muted">{m.exerciseClassification.analysisHint}</T>
            {(["movements", "equipment"] as const).map((kind) => (
              <View key={kind} style={{ gap: space.sm }}>
                <Button
                  variant="secondary"
                  label={kind === "movements" ? m.exerciseClassification.movement : m.exerciseClassification.equipment}
                  expanded={classificationSection === kind}
                  onPress={() => setClassificationSection(classificationSection === kind ? null : kind)}
                />
                {classificationSection === kind ? (
                  <>
                    <T>
                      {m.exerciseClassification.coverage(
                        kind === "movements"
                          ? data.classification!.movementKnownItems
                          : data.classification!.equipmentKnownItems,
                        data.classification!.items,
                      )}
                    </T>
                    {data.classification![kind].map((row) => (
                      <View key={row.key} style={{ gap: space.xs }}>
                        <T variant="smallStrong">{exerciseClassificationLabel(kind, row.key)}</T>
                        <T>
                          {t.occurrences} : {row.occurrences} · {t.prescribedSets} :{" "}
                          {row.plannedSetsKnownItems ? row.plannedSets : t.missing} · {t.workSets} :{" "}
                          {row.completedWorkSets}
                        </T>
                        <T tone="muted">
                          {m.exerciseClassification.setsCoverage(row.plannedSetsKnownItems, row.occurrences)}
                        </T>
                      </View>
                    ))}
                  </>
                ) : null}
              </View>
            ))}
          </View>
        </Card>
      ) : null}
      {data.intensity ? <NativeTrainingIntensity data={data.intensity} /> : null}
      {data.healthVisible ? (
        <Card>
          <View style={{ gap: space.sm }}>
            <SectionTitle>{t.health}</SectionTitle>
            <T variant="figure">{value(data.totals.perceivedLoad)}</T>
            <T>
              {t.healthCoverage} : {data.totals.loadResponses} / {data.totals.healthEligibleSessions}
            </T>
            <Button
              label={t.healthMethod}
              variant="secondary"
              expanded={healthMethod}
              onPress={() => setHealthMethod(!healthMethod)}
            />
            {healthMethod ? (
              <>
                <T tone="muted">{t.healthHint}</T>
                <T tone="muted">{t.healthResponses}</T>
                <T tone="muted">{t.healthCoverageHint}</T>
              </>
            ) : null}
            <T variant="smallStrong">{t.healthWeekly}</T>
            {healthPoints.filter((point) => point.value !== null).length >= 2 ? (
              <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <T>
                  {historyNumber(health.max)} · {t.healthUnit}
                </T>
                <Svg viewBox="0 0 600 200" width="100%" height={180}>
                  <Path d="M20,20V180H580" stroke={palette.border} fill="none" />
                  <Path d={health.path} stroke={palette.link} strokeWidth={3} fill="none" />
                  {health.dots
                    .filter((point) => point.y !== null)
                    .map((point) => (
                      <Circle key={point.date} cx={point.x} cy={point.y!} r={4} fill={palette.link} />
                    ))}
                </Svg>
                <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <T>0 · {historyDate(healthPoints[0]?.date ?? data.from)}</T>
                  <T>{historyDate(healthPoints.at(-1)?.date ?? data.to)}</T>
                </View>
              </View>
            ) : (
              <T tone="muted">{t.healthChartEmpty}</T>
            )}
            <Button
              label={t.healthTable}
              variant="secondary"
              expanded={healthTable}
              onPress={() => setHealthTable(!healthTable)}
            />
            {healthTable
              ? healthPoints.map((point) => (
                  <View key={point.date} style={{ gap: space.xs }}>
                    <T variant="smallStrong">{historyDate(point.date)}</T>
                    <T>
                      {t.healthValue} : {value(point.value)}
                    </T>
                    <T tone="muted">
                      {t.healthCoverage} : {point.knownSessions} / {point.sessions}
                    </T>
                  </View>
                ))
              : null}
            <T variant="smallStrong">{t.prior}</T>
            <T>
              {historyDate(data.previousFrom)} – {historyDate(data.previousTo)}
            </T>
            <T>
              {t.healthValue} : {value(data.previous.perceivedLoad)}
            </T>
            <T tone="muted">
              {t.healthCoverage} : {data.previous.loadResponses} / {data.previous.healthEligibleSessions}
            </T>
          </View>
        </Card>
      ) : null}
    </View>
  );
}
