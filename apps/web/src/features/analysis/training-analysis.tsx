"use client";
import { TrainingIntensityView } from "./training-intensity";
import type { TrainingAnalysis } from "@tartan/contracts";
import {
  analysisChartPoints,
  analysisGaps,
  analysisPerceivedLoadPoints,
  analysisVolumeKeys,
  historyChartGeometry,
  type AnalysisGap,
} from "@tartan/domain";
import { historyDate, historyNumber, exerciseClassificationLabel, m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Mark, Rows, Sheet, SheetSection } from "@/components/sheet";
import { Field, Select } from "@/components/ui/field";
import { Missing } from "./missing";
const t = m.analysis;
const ratio = (a: number, b: number) => `${a} / ${b}`;
const value = (n: number | null): ReactNode => (n === null ? <Missing /> : historyNumber(n));

// Une ligne de feuille : le libellé à gauche, la valeur alignée à droite en chiffres tabulaires.
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <li className="flex min-h-11 items-baseline justify-between gap-4 py-2">
    <span className="text-soft">{label}</span>
    <Mark className="text-[20px] leading-6">{children}</Mark>
  </li>
);

const gapText = (gap: AnalysisGap) => w.analysis.gaps[gap.kind](gap.missing, gap.total);
const gapLink = (gap: AnalysisGap) =>
  gap.kind === "classification"
    ? { href: "/exercices", label: w.analysis.gaps.toExercises }
    : { href: "/suivi", label: w.analysis.gaps.toTracking };

// Les manques regroupés en une invitation, au lieu d'un « Non renseigné » répété sous chaque chiffre.
function Gaps({ gaps }: { gaps: AnalysisGap[] }) {
  if (!gaps.length) return null;
  return (
    <SheetSection title={w.analysis.gaps.title} className="border-t border-card-line">
      <p className="text-soft">{w.analysis.gaps.intro}</p>
      <ul className="mt-2 divide-y divide-card-line">
        {gaps.map((gap, index) => {
          const link = gapLink(gap);
          // Un seul lien par destination : le premier manque qui y mène le porte.
          const first = gaps.findIndex((other) => gapLink(other).href === link.href) === index;
          return (
            <li key={gap.kind} className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
              <span className="min-w-0 flex-1 basis-60">{gapText(gap)}</span>
              {first ? (
                <Link
                  href={link.href}
                  className="flex min-h-11 items-center font-semibold text-ctx-link underline underline-offset-4"
                >
                  {link.label}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </SheetSection>
  );
}

// La phrase clé : combien de séances attribuées ont été faites. Elle se lit avant tout autre chiffre.
function KeyLine({ completed, assigned }: { completed: number; assigned: number }) {
  if (!assigned) return <p className="t-h2">{w.analysis.key.none}</p>;
  return (
    <div className="space-y-1">
      <p className="font-display text-[32px] font-semibold leading-9 desktop:text-[40px] desktop:leading-[44px]">
        <span className="t-num">{completed}</span> {w.analysis.key.completed(completed)}{" "}
        <span className="text-soft">
          {w.analysis.key.on} <span className="t-num">{assigned}</span> {w.analysis.key.assigned(assigned)}
        </span>
      </p>
      <p className="text-soft">{w.analysis.key.detail}</p>
    </div>
  );
}

export function TrainingAnalysisView({ data }: { data: TrainingAnalysis }) {
  const [metric, setMetric] = useState<(typeof analysisVolumeKeys)[number]>("tonnageKg");
  const planned = analysisChartPoints(data, metric, "planned"),
    actual = analysisChartPoints(data, metric, "actual");
  const max = Math.max(1, ...[...planned, ...actual].map((p) => p.value ?? 0));
  const p = historyChartGeometry(planned, max),
    a = historyChartGeometry(actual, max);
  const healthPoints = analysisPerceivedLoadPoints(data);
  const health = historyChartGeometry(healthPoints);
  const gaps = analysisGaps(data);
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
      {/* Sur ordinateur, deux colonnes : la synthèse et ses manques à gauche, l'évolution à droite. */}
      <div className="grid min-w-0 gap-4 desktop:grid-cols-2 desktop:items-start" data-testid="analysis-grid">
        <Sheet>
          <SheetSection title={t.volumes}>
            <KeyLine completed={data.totals.completedSessions} assigned={data.totals.assignedSessions} />
            <Rows className="mt-3 border-t border-card-line">
              <Row label={t.sessions}>{data.totals.assignedSessions}</Row>
              <Row label={t.responseRate}>{ratio(data.totals.loggedSessions, data.totals.assignedSessions)}</Row>
              <Row label={t.details}>{ratio(data.totals.detailedSessions, data.totals.completedSessions)}</Row>
              <Row label={t.frozen}>{ratio(data.totals.frozenSessions, data.totals.assignedSessions)}</Row>
              <Row label={t.workSets}>{data.totals.completedWorkSets}</Row>
              <Row label={t.prescribedSets}>{data.totals.plannedSets}</Row>
            </Rows>
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
          <Gaps gaps={gaps} />
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
              <dl className="grid grid-cols-2 gap-3" aria-live="polite">
                <div>
                  <dt className="text-soft">{t.planned}</dt>
                  <dd className="t-num text-[28px] leading-8">{value(data.totals.planned[metric])}</dd>
                  <dd className="t-caption text-soft">
                    {t.plannedCoverage} : {ratio(data.totals.plannedKnownItems[metric], data.totals.plannedItems)}
                  </dd>
                </div>
                <div>
                  <dt className="text-soft">{t.actual}</dt>
                  <dd className="t-num text-[28px] leading-8">{value(data.totals.actual[metric])}</dd>
                  <dd className="t-caption text-soft">
                    {t.actualCoverage} : {ratio(data.totals.actualKnownSets[metric], data.totals.completedWorkSets)}
                  </dd>
                </div>
              </dl>
              {p.showChart || a.showChart ? (
                <div aria-hidden="true">
                  <p className="t-caption">
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
                  <div className="t-caption flex justify-between">
                    <span>0 · {historyDate(data.weeks[0]?.weekStart ?? data.from)}</span>
                    <span>{historyDate(data.weeks.at(-1)?.weekStart ?? data.to)}</span>
                  </div>
                  <p className="t-caption">
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
                    {data.weeks.map((week) => (
                      <tr key={week.weekStart} className="border-t border-card-line">
                        <th scope="row" className="py-3 font-normal">
                          {historyDate(week.weekStart)}
                        </th>
                        <td>{value(week.totals.planned[metric])}</td>
                        <td>{value(week.totals.actual[metric])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <div className="border-t border-card-line pt-3">
                <h3 className="font-semibold">{t.prior}</h3>
                <p className="text-soft">
                  {historyDate(data.previousFrom)} – {historyDate(data.previousTo)}
                </p>
                <Rows>
                  <Row label={t.planned}>{value(data.previous.planned[metric])}</Row>
                  <Row label={t.actual}>{value(data.previous.actual[metric])}</Row>
                </Rows>
                <p className="t-caption text-soft">
                  {t.actualCoverage} : {ratio(data.previous.actualKnownSets[metric], data.previous.completedWorkSets)} ·{" "}
                  {t.details} : {ratio(data.previous.detailedSessions, data.previous.completedSessions)}
                </p>
              </div>
            </div>
          </SheetSection>
        </Sheet>
        <Sheet>
          <SheetSection title={t.distribution}>
            <div className="space-y-2">
              <Rows>
                {data.categories.map((row) => (
                  <li key={row.category} className="py-2">
                    <strong>{(m.exerciseCategory as Record<string, string>)[row.category] ?? row.category}</strong> :{" "}
                    {row.plannedSets} {t.prescribedSets.toLocaleLowerCase("fr")} · {row.completedWorkSets}{" "}
                    {t.workSets.toLocaleLowerCase("fr")}
                  </li>
                ))}
              </Rows>
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
          <SheetSection title={t.diversity} className="border-t border-card-line">
            <p className="text-soft">
              {historyDate(data.diversity28Days.from)} – {historyDate(data.diversity28Days.to)}
            </p>
            <Rows>
              <Row label={t.distinct}>{data.diversity28Days.distinctExercises}</Row>
              <Row label={t.occurrences}>{data.diversity28Days.occurrences}</Row>
            </Rows>
            <p className="t-caption text-soft">{t.diversityHint}</p>
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
                          {row.plannedSetsKnownItems ? row.plannedSets : <Missing />}{" "}
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
        {data.intensity ? <TrainingIntensityView data={data.intensity} /> : null}
        {data.healthVisible ? (
          <Sheet>
            <SheetSection title={t.health}>
              <Rows>
                <Row label={t.healthValue}>{value(data.totals.perceivedLoad)}</Row>
                <Row label={t.healthCoverage}>{ratio(data.totals.loadResponses, data.totals.healthEligibleSessions)}</Row>
              </Rows>
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
                  <p className="t-caption">
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
                  <div className="t-caption flex justify-between">
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
              <div className="border-t border-card-line pt-3">
                <h3 className="font-semibold">{t.prior}</h3>
                <p className="text-soft">
                  {historyDate(data.previousFrom)} – {historyDate(data.previousTo)}
                </p>
                <Rows>
                  <Row label={t.healthValue}>{value(data.previous.perceivedLoad)}</Row>
                  <Row label={t.healthCoverage}>
                    {ratio(data.previous.loadResponses, data.previous.healthEligibleSessions)}
                  </Row>
                </Rows>
              </div>
            </SheetSection>
          </Sheet>
        ) : null}
      </div>
    </div>
  );
}
