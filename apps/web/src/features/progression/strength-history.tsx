"use client";

import { useMemo, useState } from "react";
import type { ExerciseHistory } from "@tartan/contracts";
import { historyChartGeometry, strengthHistoryCurves } from "@tartan/domain";
import { historyDate, historyNumber, m, strengthCurveLabel } from "@tartan/i18n";
import { Sheet, SheetSection } from "@/components/sheet";
import { Field, Select } from "@/components/ui/field";

const t = m.strengthHistory;
export function StrengthHistory({ history }: { history: ExerciseHistory }) {
  const curves = useMemo(() => strengthHistoryCurves(history), [history]);
  const [selected, setSelected] = useState<string | null>(null);
  const current = curves.find((curve) => curve.key === selected) ?? curves[0];
  if (!current && history.exercise.loadKind !== "external_total" && history.exercise.loadKind !== "added_weight")
    return null;
  const geometry = historyChartGeometry(current?.points ?? []);
  const known = current?.points.filter((point) => point.value !== null) ?? [];
  const tests = current?.source.startsWith("test_");
  const label = current ? strengthCurveLabel(current) : "";
  return (
    <Sheet>
      <SheetSection title={t.title}>
        {!current ? (
          <p>{t.empty}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label={t.choose} hint={label}>
              {(props) => (
                <Select {...props} value={current.key} onChange={(event) => setSelected(event.target.value)}>
                  {curves.map((curve) => (
                    <option key={curve.key} value={curve.key}>
                      {strengthCurveLabel(curve)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div aria-live="polite">
              <p>{t.summary(historyNumber(known[0]!.value!), historyNumber(known.at(-1)!.value!))}</p>
              <p className="text-soft">{t.dates(known.length)}</p>
            </div>
            {!tests && history.coverage.truncated ? <p role="status">{m.exerciseHistory.truncated}</p> : null}
            {geometry.showChart ? (
              <div aria-hidden="true">
                <div className="flex justify-between text-sm">
                  <span>{historyNumber(geometry.max)}</span>
                  <span>{t.value}</span>
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
                  <span>0 · {historyDate(current.points[0]!.date)}</span>
                  <span>{historyDate(current.points.at(-1)!.date)}</span>
                </div>
              </div>
            ) : (
              <p className="text-soft">{m.exerciseHistory.chartEmpty}</p>
            )}
            <details>
              <summary className="min-h-11 cursor-pointer py-3 font-semibold">{t.method}</summary>
              <div className="space-y-2 text-soft">
                <p>{t.commonHint}</p>
                <p>
                  {current.source === "work_epley"
                    ? t.estimateHint
                    : current.source === "work_load"
                      ? t.loadHint
                      : t.testHint}
                </p>
                <p>{tests ? t.testScope : m.exerciseHistory.scope}</p>
              </div>
            </details>
            <details>
              <summary className="min-h-11 cursor-pointer py-3 font-semibold">{t.table}</summary>
              <table className="w-full table-fixed text-left tabular-nums">
                <caption className="sr-only">{label}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="py-2">
                      {m.exerciseHistory.date}
                    </th>
                    <th scope="col">{t.value}</th>
                    <th scope="col">{tests ? t.coverageTests : t.coverageWork}</th>
                  </tr>
                </thead>
                <tbody>
                  {current.points.map((point) => (
                    <tr key={point.date} className="border-t border-card-line">
                      <th scope="row" className="py-3 font-normal">
                        {historyDate(point.date)}
                      </th>
                      <td>{point.value === null ? m.exerciseHistory.missing : historyNumber(point.value)}</td>
                      <td>{m.exerciseHistory.coverageValue(point.knownSessions, point.sessions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        )}
      </SheetSection>
    </Sheet>
  );
}
