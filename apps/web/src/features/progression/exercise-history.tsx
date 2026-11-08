"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ExerciseHistory } from "@tartan/contracts";
import {
  formatPrescription,
  historyChartGeometry,
  historyPeriods,
  historyVolumePoints,
  volumeMetrics,
  type HistoryPeriod,
  type VolumeMetric,
} from "@tartan/domain";
import { m, historyDate, historyNumber, realizedSetLabel } from "@tartan/i18n";
import { Sheet, SheetSection } from "@/components/sheet";
import { Field, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { StrengthCalculator } from "./strength-calculator";

const t = m.exerciseHistory;
export function ExerciseHistoryView({
  exercises,
  history,
  days,
}: {
  exercises: { id: string; name: string; archived: boolean }[];
  history: ExerciseHistory | null;
  days: HistoryPeriod;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [metric, setMetric] = useState<VolumeMetric>("tonnageKg");
  const [limit, setLimit] = useState(10);
  const change = (exercise: string, period: number) =>
    startTransition(() =>
      router.replace(`${pathname}?${new URLSearchParams({ exercise, days: String(period) })}`, { scroll: false }),
    );
  const points = historyVolumePoints(history?.sessions ?? [], metric);
  const geometry = historyChartGeometry(points);
  const known = points.filter((point) => point.value !== null);
  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <p className="text-soft">{t.intro}</p>
      {!history ? (
        <p>{t.empty}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.exercise}>
              {(props) => (
                <Select
                  {...props}
                  value={history.exercise.id}
                  disabled={pending}
                  onChange={(event) => change(event.target.value, days)}
                >
                  {exercises.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                      {exercise.archived ? ` · ${t.archived}` : ""}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t.period}>
              {(props) => (
                <Select
                  {...props}
                  value={days}
                  disabled={pending}
                  onChange={(event) => change(history.exercise.id, Number(event.target.value))}
                >
                  {historyPeriods.map((period) => (
                    <option key={period} value={period}>
                      {t.periods[period]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <p className="text-soft">
            {historyDate(history.from)} – {historyDate(history.to)}
          </p>
          <Sheet>
            <SheetSection title={m.strength.currentReference}>
              {history.reference ? (
                <>
                  <p>
                    <strong className="t-num text-2xl">{historyNumber(history.reference.valueKg)} kg</strong> ·{" "}
                    {m.strength.referenceKinds[history.reference.kind]}
                  </p>
                  <p className="text-soft">{t.selectedOn(historyDate(history.reference.selectedAt))}</p>
                </>
              ) : (
                <p>{m.strength.noReference}</p>
              )}
              <p className="text-soft">
                {m.strength.conventions[history.exercise.loadKind as keyof typeof m.strength.conventions] ??
                  m.strength.unknownConvention}
              </p>
            </SheetSection>
            {history.tests.length > 0 ? (
              <SheetSection title={t.tests}>
                <ul className="divide-y divide-card-line">
                  {history.tests.map((test) => (
                    <li key={test.id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span>{historyDate(test.date)}</span>
                      <span>
                        {historyNumber(test.value)} kg · {m.testKind[test.kind as keyof typeof m.testKind] ?? test.kind}
                      </span>
                    </li>
                  ))}
                </ul>
              </SheetSection>
            ) : null}
          </Sheet>
          <Sheet>
            <SheetSection title={t.volumes}>
              <div className="flex flex-col gap-3">
                <Field label={t.metric}>
                  {(props) => (
                    <Select
                      {...props}
                      value={metric}
                      onChange={(event) => setMetric(event.target.value as VolumeMetric)}
                    >
                      {volumeMetrics.map((key) => (
                        <option key={key} value={key}>
                          {t.metrics[key]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <p>{t.coverage(history.coverage.returnedSessions, history.coverage.totalSessions)}</p>
                {history.coverage.truncated ? <p role="status">{t.truncated}</p> : null}
                {history.coverage.unusableSets ? <p>{t.unusable(history.coverage.unusableSets)}</p> : null}
                <p aria-live="polite">
                  {known.length
                    ? t.summary(known.length, historyNumber(known.reduce((total, point) => total + point.value!, 0)))
                    : t.noMeasurements}
                </p>
                {geometry.showChart ? (
                  <div aria-hidden="true">
                    <div className="flex justify-between text-sm">
                      <span>{historyNumber(geometry.max)}</span>
                      <span>{t.metrics[metric]}</span>
                    </div>
                    <svg viewBox="0 0 600 200" className="w-full" focusable="false">
                      <path d="M20,20V180H580" className="stroke-card-line" fill="none" />
                      <path d={geometry.path} stroke="currentColor" strokeWidth="2" fill="none" />
                      {geometry.dots
                        .filter((point) => point.y !== null)
                        .map((point) => (
                          <circle key={point.date} cx={point.x} cy={point.y!} r="4" fill="currentColor" />
                        ))}
                    </svg>
                    <div className="flex justify-between gap-2 text-sm">
                      <span>0 · {historyDate(points[0]!.date)}</span>
                      <span>{historyDate(points.at(-1)!.date)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-soft">{t.chartEmpty}</p>
                )}
                <details>
                  <summary className="min-h-11 cursor-pointer py-3 font-semibold">{t.method}</summary>
                  <div className="space-y-2 text-soft">
                    <p>{t.chartHint}</p>
                    <p>{t.scope}</p>
                  </div>
                </details>
                <details>
                  <summary className="min-h-11 cursor-pointer py-3 font-semibold">{t.table}</summary>
                  <table className="w-full table-fixed text-left tabular-nums">
                    <caption className="sr-only">{t.metrics[metric]}</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="py-2">
                          {t.date}
                        </th>
                        <th scope="col">{t.value}</th>
                        <th scope="col">{t.coverageColumn}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {points.map((point) => (
                        <tr key={point.date} className="border-t border-card-line">
                          <th scope="row" className="py-3 font-normal">
                            {historyDate(point.date)}
                          </th>
                          <td>{point.value === null ? t.missing : historyNumber(point.value)}</td>
                          <td>{t.coverageValue(point.knownSessions, point.sessions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </div>
            </SheetSection>
          </Sheet>
          <Sheet>
            <SheetSection title={t.sessions}>
              {!history.sessions.length ? (
                <p>{t.noSessions}</p>
              ) : (
                history.sessions.slice(0, limit).map((session) => (
                  <details key={session.logId} className="border-b border-card-line last:border-0">
                    <summary className="min-h-11 cursor-pointer py-3">
                      <strong>{historyDate(session.date)}</strong> · {session.title}
                    </summary>
                    <div className="flex flex-col gap-3 pb-4">
                      <p className="text-soft">
                        {t.updatedOn(historyDate(session.updatedAt))} · {m.progression[session.status]}
                      </p>
                      {session.items.map((item) => (
                        <div key={item.itemRef} className="flex flex-col gap-2">
                          <h3 className="font-semibold">{item.name}</h3>
                          <p>
                            {t.prescribed} : {formatPrescription(item.prescription, item.resolvedLoadKg)}
                          </p>
                          <h4 className="font-semibold">{t.realized}</h4>
                          {item.sets.length ? (
                            <ol className="list-inside list-decimal space-y-2">
                              {item.sets.map((set) => (
                                <li key={set.setIndex}>{realizedSetLabel(set, item.strengthLoadKind)}</li>
                              ))}
                            </ol>
                          ) : (
                            <p>{t.missing}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                ))
              )}
              {history.sessions.length > limit ? (
                <Button variant="secondary" className="mt-3" onClick={() => setLimit((value) => value + 10)}>
                  {t.more}
                </Button>
              ) : null}
            </SheetSection>
          </Sheet>
          {history.exercise.loadKind === "external_total" ? (
            <details>
              <summary className="min-h-11 cursor-pointer py-3 font-semibold">{t.calculator}</summary>
              <StrengthCalculator
                key={`${history.exercise.id}:${history.reference?.id}:${history.reference?.valueKg}`}
                referenceKg={history.reference?.valueKg}
                stepKg={history.exercise.stepKg}
              />
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
