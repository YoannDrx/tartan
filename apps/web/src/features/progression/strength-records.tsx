"use client";

import { useState } from "react";
import type { StrengthRecordValue } from "@tartan/contracts";
import { historyDate, historyNumber, m, strengthRecordConvention, strengthRecordLabel } from "@tartan/i18n";
import { Sheet, SheetSection } from "@/components/sheet";
import { Field, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const t = m.strengthRecords;
export function StrengthRecords({ records }: { records: StrengthRecordValue[] | undefined }) {
  const [kind, setKind] = useState<StrengthRecordValue["kind"]>("load_at_reps");
  const [limit, setLimit] = useState(10);
  if (!records) return null;
  const selected = records.filter((record) => record.kind === kind);
  return (
    <Sheet>
      <SheetSection title={t.title}>
        <div className="flex flex-col gap-3">
          <p className="text-soft">{t.scope}</p>
          <Field label={t.measure}>
            {(props) => (
              <Select
                {...props}
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value as StrengthRecordValue["kind"]);
                  setLimit(10);
                }}
              >
                {Object.entries(t.kinds).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {kind === "estimated_one_rm" ? <p className="text-soft">{t.estimate}</p> : null}
          {!selected.length ? (
            <p>{t.empty}</p>
          ) : (
            <ul className="divide-y divide-card-line">
              {selected.slice(0, limit).map((record) => (
                <li key={record.comparisonKey} className="flex flex-col gap-1 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <strong>{strengthRecordLabel(record)}</strong>
                    <span className="t-num text-xl">
                      {record.kind === "reps_at_load"
                        ? t.repsValue(historyNumber(record.value))
                        : `${historyNumber(record.value)} kg`}
                    </span>
                  </div>
                  <span>
                    {record.baseline ? t.baseline : t.record} · {historyDate(record.date)}
                  </span>
                  <span className="text-soft">{strengthRecordConvention(record)}</span>
                </li>
              ))}
            </ul>
          )}
          {selected.length > limit ? (
            <Button variant="secondary" onClick={() => setLimit((old) => old + 10)}>
              {t.more}
            </Button>
          ) : null}
        </div>
      </SheetSection>
    </Sheet>
  );
}
