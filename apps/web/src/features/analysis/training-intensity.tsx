"use client";
import type { TrainingAnalysis, IntensityMetric, IntensitySummary } from "@tartan/contracts";
import { emptyIntensitySummary, intensityComparisonRows, intensityMetrics } from "@tartan/domain";
import { historyNumber, m } from "@tartan/i18n";
import { useState } from "react";
import { Sheet, SheetSection } from "@/components/sheet";
import { Field, Select } from "@/components/ui/field";
const t = m.intensityAnalysis;
function Observation({ label, data }: { label: string; data: IntensitySummary }) {
  return (
    <div>
      <p className="font-medium">{label}</p>
      <p>
        {data.mean === null
          ? m.analysis.missing
          : t.values(historyNumber(data.mean), historyNumber(data.min!), historyNumber(data.max!))}
      </p>
      <p className="text-soft">{t.observations(data.count, data.eligible)}</p>
    </div>
  );
}
export function TrainingIntensityView({ data }: { data: NonNullable<TrainingAnalysis["intensity"]> }) {
  const [metric, setMetric] = useState<IntensityMetric>("kg");
  const rows = intensityComparisonRows(data, metric);
  return (
    <Sheet>
      <SheetSection title={t.title}>
        <Field label={t.chooseMetric}>
          {(props) => (
            <Select {...props} value={metric} onChange={(e) => setMetric(e.target.value as IntensityMetric)}>
              {intensityMetrics.map((key) => (
                <option key={key} value={key}>
                  {t.units[key]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <details>
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">{t.method}</summary>
          <div className="space-y-2 text-soft">
            <p>{t.hint}</p>
            <p>{t.means}</p>
            <p>{t.reference}</p>
            <p>{t.targets}</p>
            <p>
              {t.current} : {t.omitted(data.current.unlinkedItems, data.current.unmatchedWorkSets)}
            </p>
            <p>
              {t.previous} : {t.omitted(data.previous.unlinkedItems, data.previous.unmatchedWorkSets)}
            </p>
          </div>
        </details>
        {!rows.length ? (
          <p>{t.empty}</p>
        ) : (
          <ul className="divide-y divide-card-line">
            {rows.map(({ row, current, previous }) => (
              <li key={row.key} className="space-y-3 py-4">
                <h3 className="font-semibold break-words">
                  {row.name} · {row.loadKind ? m.strength.conventions[row.loadKind] : m.strength.unknownConvention}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      [t.current, current],
                      [t.previous, previous],
                    ] as const
                  ).map(([label, period]) => (
                    <div key={label} className="space-y-2">
                      <h4 className="font-semibold">{label}</h4>
                      <Observation label={t.planned} data={period?.planned ?? emptyIntensitySummary()} />
                      {row.actual !== null ? (
                        <Observation label={t.actual} data={period?.actual ?? emptyIntensitySummary()} />
                      ) : null}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SheetSection>
    </Sheet>
  );
}
