import type { TrackingGrid } from "@tartan/contracts";
import { formatWeekdayShort } from "@tartan/i18n";
import { StatusIcon } from "@/components/status-cell";

// La semaine d'un athlète en une ligne : un disque par séance, dans l'ordre des jours.
export const WeekStrip = ({
  sessions,
  cells,
}: {
  sessions: TrackingGrid["sessions"];
  cells: TrackingGrid["rows"][number]["cells"];
}) => (
  <ul className="flex flex-wrap items-center gap-0.5">
    {sessions.map((s) => {
      const status = cells.find((c) => c.sessionId === s.id)?.status;
      return (
        <li key={s.id} className="flex size-[18px] items-center justify-center">
          {status ? (
            <>
              <span className="sr-only">{formatWeekdayShort(s.date)} : </span>
              <StatusIcon status={status} size={18} />
            </>
          ) : (
            <span aria-hidden className="h-0.5 w-2 rounded-full bg-card-raised" />
          )}
        </li>
      );
    })}
  </ul>
);
