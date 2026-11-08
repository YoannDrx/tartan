"use client";
import type { TrainingAnalysis } from "@tartan/contracts";
import {
  analysisChartPoints,
  analysisPerceivedLoadPoints,
  analysisVolumeKeys,
  historyChartGeometry,
} from "@tartan/domain";
import { historyDate, historyNumber, exerciseClassificationLabel, m } from "@tartan/i18n";
import { useState } from "react";
import { Sheet, SheetSection } from "@/components/sheet";
import { Field, Select } from "@/components/ui/field";
const t = m.analysis;
const value = (n: number | null) => (n === null ? t.missing : historyNumber(n));
const ratio = (a: number, b: number) => `${a} / ${b}`;
export function TrainingAnalysisView({ data }: { data: TrainingAnalysis }) {
  const [metric, setMetric] = useState<(typeof analysisVolumeKeys)[number]>("tonnageKg");
  const planned = analysisChartPoints(data, metric, "planned"),
    actual = analysisChartPoints(data, metric, "actual");
  const max = Math.max(1, ...[...planned, ...actual].map((p) => p.value ?? 0));
  const p = historyChartGeometry(planned, max),
    a = historyChartGeometry(actual, max);
  const healthPoints = analysisPerceivedLoadPoints(data);
  const health = historyChartGeometry(healthPoints);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {data.phase ? (
        <div role="status" className="space-y-2">
          <p>
            {data.phase.name} — {data.phase.basis === "prescription" ? t.phaseStored : t.phasePublic}
          </p>
          {data.phase.coverage ? (
            <p className="text-soft">
              {t.phaseCoverage(
                data.phase.coverage.matched,
                data.phase.coverage.withoutReference,
                data.phase.coverage.otherPhase,
              )}
            </p>
          ) : null}
          <details>
            <summary className="min-h-11 cursor-pointer py-3 font-semibold">{t.phaseMethod}</summary>
            <p className="text-soft">{data.phase.basis === "prescription" ? t.phaseAttributedScope : t.phaseScope}</p>
            {data.phase.basis === "prescription" ? <p className="text-soft">{t.phasePriorScope}</p> : null}
          </details>
        </div>
      ) : null}
      <Sheet>
        <SheetSection title={t.volumes}>
          <dl className="grid grid-cols-2 gap-3">
            {[
              [t.sessions, data.totals.assignedSessions],
              [t.completed, data.totals.completedSessions],
              [t.details, ratio(data.totals.detailedSessions, data.totals.completedSessions)],
              [t.frozen, ratio(data.totals.frozenSessions, data.totals.assignedSessions)],
              [t.workSets, data.totals.completedWorkSets],
              [t.prescribedSets, data.totals.plannedSets],
              [t.responseRate, ratio(data.totals.loggedSessions, data.totals.assignedSessions)],
            ].map(([label, n]) => (
              <div key={label}>
                <dt className="text-soft">{label}</dt>
                <dd className="text-xl font-semibold tabular-nums">{n}</dd>
              </div>
            ))}
          </dl>
          <details>
            <summary className="min-h-11 cursor-pointer py-3 font-semibold">{t.method}</summary>
            <div className="space-y-2 text-soft">
              <p>{t.scope}</p>
              <p>{t.noSubstitution}</p>
              <p>{t.historical}</p>
              <p>{t.partialWeeks}</p>
            </div>
          </details>
        </SheetSection>
      </Sheet>
      <Sheet>
        <SheetSection title={t.weekly}>
          <div className="flex flex-col gap-4">
            <Field label={t.chooseMetric}>
              {(props) => (
                <Select {...props} value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)}>
                  {analysisVolumeKeys.map((key) => (
                    <option key={key} value={key}>
                      {t.metrics[key]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-live="polite">
              <div>
                <dt>{t.planned}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{value(data.totals.planned[metric])}</dd>
                <dd className="text-soft">
                  {t.plannedCoverage} : {ratio(data.totals.plannedKnownItems[metric], data.totals.plannedItems)}
                </dd>
              </div>
              <div>
                <dt>{t.actual}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{value(data.totals.actual[metric])}</dd>
                <dd className="text-soft">
                  {t.actualCoverage} : {ratio(data.totals.actualKnownSets[metric], data.totals.completedWorkSets)}
                </dd>
              </div>
            </dl>
            {p.showChart || a.showChart ? (
              <div aria-hidden="true">
                <p className="text-sm">
                  {historyNumber(max)} · {t.metrics[metric]}
                </p>
                <svg viewBox="0 0 600 200" className="w-full" focusable="false">
                  <path d="M20,20V180H580" className="stroke-card-line" fill="none" />
                  <path d={p.path} stroke="currentColor" strokeWidth="2" strokeDasharray="6 5" fill="none" />
                  <path d={a.path} className="stroke-brand" strokeWidth="3" fill="none" />
                  {a.dots
                    .filter((d) => d.y !== null)
                    .map((d) => (
                      <circle key={d.date} cx={d.x} cy={d.y!} r="4" className="fill-brand" />
                    ))}
                </svg>
                <div className="flex justify-between text-sm">
                  <span>0 · {historyDate(data.weeks[0]?.weekStart ?? data.from)}</span>
                  <span>{historyDate(data.weeks.at(-1)?.weekStart ?? data.to)}</span>
                </div>
                <p className="text-sm">
                  {t.planned} · {m.analysis.dashed} / {t.actual} · {m.analysis.solid}
                </p>
              </div>
            ) : (
              <p className="text-soft">{m.exerciseHistory.chartEmpty}</p>
            )}
            <details>
              <summary className="min-h-11 cursor-pointer py-3 font-semibold">{t.table}</summary>
              <table className="w-full table-fixed text-left text-sm tabular-nums">
                <caption className="sr-only">{t.metrics[metric]}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t.week}</th>
                    <th scope="col">{t.planned}</th>
                    <th scope="col">{t.actual}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.weeks.map((w) => (
                    <tr key={w.weekStart} className="border-t border-card-line">
                      <th scope="row" className="py-3 font-normal">
                        {historyDate(w.weekStart)}
                      </th>
                      <td>{value(w.totals.planned[metric])}</td>
                      <td>{value(w.totals.actual[metric])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
            <div>
              <h3 className="font-semibold">{t.prior}</h3>
              <p>
                {historyDate(data.previousFrom)} – {historyDate(data.previousTo)}
              </p>
              <p>
                {t.planned} : {value(data.previous.planned[metric])} · {t.actual} :{" "}
                {value(data.previous.actual[metric])}
              </p>
              <p className="text-soft">
                {t.actualCoverage} : {ratio(data.previous.actualKnownSets[metric], data.previous.completedWorkSets)} ·{" "}
                {t.details} : {ratio(data.previous.detailedSessions, data.previous.completedSessions)}
              </p>
            </div>
          </div>
        </SheetSection>
      </Sheet>
      <Sheet>
        <SheetSection title={t.diversity}>
          <p>
            {historyDate(data.diversity28Days.from)} – {historyDate(data.diversity28Days.to)}
          </p>
          <p className="text-xl font-semibold">
            {data.diversity28Days.distinctExercises} {t.distinct.toLocaleLowerCase("fr")}
          </p>
          <p>
            {data.diversity28Days.occurrences} {t.occurrences.toLocaleLowerCase("fr")}
          </p>
          <p className="text-soft">{t.diversityHint}</p>
        </SheetSection>
      </Sheet>
      <Sheet>
        <SheetSection title={t.distribution}>
          <div className="space-y-4">
            <ul className="space-y-2">
              {data.categories.map((row) => (
                <li key={row.category}>
                  <strong>{(m.exerciseCategory as Record<string, string>)[row.category] ?? row.category}</strong> :{" "}
                  {row.plannedSets} {t.prescribedSets.toLocaleLowerCase("fr")} · {row.completedWorkSets}{" "}
                  {t.workSets.toLocaleLowerCase("fr")}
                </li>
              ))}
            </ul>
            <details>
              <summary className="min-h-11 cursor-pointer py-3 font-semibold">{t.exercise}</summary>
              <ul className="divide-y divide-card-line">
                {data.exercises.map((row) => (
                  <li key={row.key} className="space-y-1 py-3">
                    <p className="font-semibold break-words">{row.name}</p>
                    <p>
                      {row.occurrences} {t.occurrences.toLocaleLowerCase("fr")} · {row.plannedSets}{" "}
                      {t.prescribedSets.toLocaleLowerCase("fr")} · {row.completedWorkSets}{" "}
                      {t.workSets.toLocaleLowerCase("fr")}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </SheetSection>
      </Sheet>
      {data.classification ? (
        <Sheet>
          <SheetSection title={m.exerciseClassification.title}>
            <p className="text-soft">{m.exerciseClassification.analysisHint}</p>
            {(["movements", "equipment"] as const).map((kind) => (
              <details key={kind}>
                <summary className="min-h-11 cursor-pointer py-3 font-semibold">
                  {kind === "movements" ? m.exerciseClassification.movement : m.exerciseClassification.equipment}
                </summary>
                <p>
                  {m.exerciseClassification.coverage(
                    kind === "movements"
                      ? data.classification!.movementKnownItems
                      : data.classification!.equipmentKnownItems,
                    data.classification!.items,
                  )}
                </p>
                <ul className="divide-y divide-card-line">
                  {data.classification![kind].map((row) => (
                    <li key={row.key} className="space-y-1 py-3">
                      <p className="font-semibold">{exerciseClassificationLabel(kind, row.key)}</p>
                      <p>
                        {row.occurrences} {t.occurrences.toLocaleLowerCase("fr")} ·{" "}
                        {row.plannedSetsKnownItems ? row.plannedSets : t.missing}{" "}
                        {t.prescribedSets.toLocaleLowerCase("fr")} · {row.completedWorkSets}{" "}
                        {t.workSets.toLocaleLowerCase("fr")}
                      </p>
                      <p className="text-soft">
                        {m.exerciseClassification.setsCoverage(row.plannedSetsKnownItems, row.occurrences)}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </SheetSection>
        </Sheet>
      ) : null}
      {data.healthVisible ? (
        <Sheet>
          <SheetSection title={t.health}>
            <p className="text-xl font-semibold">{value(data.totals.perceivedLoad)}</p>
            <p>
              {t.healthCoverage} : {ratio(data.totals.loadResponses, data.totals.healthEligibleSessions)}
            </p>
            <details>
              <summary className="min-h-11 cursor-pointer py-3 font-semibold">{t.healthMethod}</summary>
              <div className="space-y-2 text-soft">
                <p>{t.healthHint}</p>
                <p>{t.healthResponses}</p>
                <p>{t.healthCoverageHint}</p>
              </div>
            </details>
            <h3 className="font-semibold">{t.healthWeekly}</h3>
            {healthPoints.filter((point) => point.value !== null).length >= 2 ? (
              <div aria-hidden="true">
                <p className="text-sm">
                  {historyNumber(health.max)} · {t.healthUnit}
                </p>
                <svg viewBox="0 0 600 200" className="w-full" focusable="false">
                  <path d="M20,20V180H580" className="stroke-card-line" fill="none" />
                  <path d={health.path} className="stroke-brand" strokeWidth="3" fill="none" />
                  {health.dots
                    .filter((point) => point.y !== null)
                    .map((point) => (
                      <circle key={point.date} cx={point.x} cy={point.y!} r="4" className="fill-brand" />
                    ))}
                </svg>
                <div className="flex justify-between text-sm">
                  <span>0 · {historyDate(healthPoints[0]?.date ?? data.from)}</span>
                  <span>{historyDate(healthPoints.at(-1)?.date ?? data.to)}</span>
                </div>
              </div>
            ) : (
              <p className="text-soft">{t.healthChartEmpty}</p>
            )}
            <details>
              <summary className="min-h-11 cursor-pointer py-3 font-semibold">{t.healthTable}</summary>
              <table className="w-full table-fixed text-left text-sm tabular-nums">
                <caption className="sr-only">{t.healthWeekly}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t.week}</th>
                    <th scope="col">{t.healthValue}</th>
                    <th scope="col">{t.healthColumn}</th>
                  </tr>
                </thead>
                <tbody>
                  {healthPoints.map((point) => (
                    <tr key={point.date} className="border-t border-card-line">
                      <th scope="row" className="py-3 font-normal">
                        {historyDate(point.date)}
                      </th>
                      <td>{value(point.value)}</td>
                      <td>{ratio(point.knownSessions, point.sessions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
            <div>
              <h3 className="font-semibold">{t.prior}</h3>
              <p>
                {historyDate(data.previousFrom)} – {historyDate(data.previousTo)}
              </p>
              <p>
                {t.healthValue} : {value(data.previous.perceivedLoad)}
              </p>
              <p className="text-soft">
                {t.healthCoverage} : {ratio(data.previous.loadResponses, data.previous.healthEligibleSessions)}
              </p>
            </div>
          </SheetSection>
        </Sheet>
      ) : null}
    </div>
  );
}
