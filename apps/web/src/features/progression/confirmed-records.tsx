import type { StrengthRecordValue } from "@tartan/contracts";
import { historyNumber, m, strengthRecordConvention, strengthRecordLabel } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";

export function ConfirmedRecords({ records }: { records: StrengthRecordValue[] }) {
  if (!records.length) return null;
  return (
    <aside role="status" className="rounded-card border border-card-line bg-card p-4 on-card">
      <h2 className="t-h2">{m.strengthRecords.confirmed}</h2>
      <p className="mt-2 text-soft">{m.strengthRecords.confirmedHint}</p>
      <ul className="mt-3 space-y-3">
        {records.map((record) => (
          <li key={record.comparisonKey}>
            <p>
              <strong>{record.exerciseName}</strong> · {strengthRecordLabel(record)} :{" "}
              {record.kind === "reps_at_load"
                ? m.strengthRecords.repsValue(historyNumber(record.value))
                : w.progress.kilos(historyNumber(record.value))}
            </p>
            <p className="text-soft">{strengthRecordConvention(record)}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
