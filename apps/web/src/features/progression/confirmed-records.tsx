import type { ConfirmedStrengthRecord } from "@tartan/contracts";
import { historyNumber, m, strengthRecordConvention, strengthRecordLabel } from "@tartan/i18n";

export function ConfirmedRecords({ records }: { records: ConfirmedStrengthRecord[] }) {
  if (!records.length) return null;
  return (
    <aside role="status" className="rounded-card border border-card-line bg-card p-4 on-card">
      <h2 className="t-h2">{m.strengthRecords.confirmed}</h2>
      <p className="mt-2 text-soft">{m.strengthRecords.confirmedHint}</p>
      <ul className="mt-3 space-y-3">
        {records.map((record) => (
          <li key={record.eventId}>
            <p>
              <strong>{record.exerciseName}</strong> · {strengthRecordLabel(record)} :{" "}
              {record.kind === "reps_at_load"
                ? m.strengthRecords.repsValue(historyNumber(record.value))
                : `${historyNumber(record.value)} kg`}
            </p>
            <p className="text-soft">{strengthRecordConvention(record)}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
