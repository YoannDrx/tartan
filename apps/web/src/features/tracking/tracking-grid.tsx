import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { TrackingGrid } from "@tartan/contracts";
import { formatWeekdayShort, m } from "@tartan/i18n";
import { ActivityPicto } from "@/components/pictos";
import { StatusIcon, StatusLegend } from "@/components/status-cell";
import { cn } from "@/lib/cn";
import { todayIso } from "@/lib/dates";

// La semaine d'un athlète en une ligne : un disque par séance, dans l'ordre des jours.
export const WeekStrip = ({
  sessions,
  cells,
}: {
  sessions: TrackingGrid["sessions"];
  cells: TrackingGrid["rows"][number]["cells"];
}) => (
  <ul className="flex items-center gap-1">
    {sessions.map((s) => {
      const status = cells.find((c) => c.sessionId === s.id)?.status;
      return (
        <li key={s.id} className="flex size-5 items-center justify-center">
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

// La grille est l'écran de travail du coach : des lignes denses plutôt que des cartes.
export const TrackingTable = ({ grid, today = todayIso() }: { grid: TrackingGrid; today?: string }) => (
  <div className="on-card overflow-hidden rounded-card bg-card">
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse">
        <caption className="sr-only">{m.coach.trackingTitle}</caption>
        <thead>
          <tr className="border-b border-card-line">
            <th scope="col" className="sticky left-0 z-10 on-card bg-card px-3 py-2 text-left t-section">
              {m.coach.athleteCol}
            </th>
            {grid.sessions.map((s) => (
              <th
                key={s.id}
                scope="col"
                className="w-11 py-2 text-center align-bottom font-normal desktop:w-14 desktop:px-1"
              >
                <Link
                  href={`/seances/${s.id}/suivi`}
                  title={s.title}
                  className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-button py-1 leading-tight text-inherit no-underline hover:bg-raise"
                >
                  <ActivityPicto kind={s.type} className="size-[18px] text-soft" />
                  <span className="flex items-baseline gap-1 t-caption font-semibold">
                    {formatWeekdayShort(s.date)}
                    <span
                      className={cn(
                        "t-num text-[15px] max-desktop:hidden",
                        s.date === today && "rounded-full bg-brand px-1.5 text-white",
                      )}
                    >
                      {Number(s.date.slice(8))}
                    </span>
                  </span>
                  <span className="text-[12px] font-medium text-soft max-desktop:hidden">{m.sessionType[s.type]}</span>
                  <span className="sr-only">, {s.title}</span>
                </Link>
              </th>
            ))}
            <th scope="col" className="w-11 px-2 py-2 text-right t-caption text-soft desktop:w-14 desktop:px-3">
              {m.coach.doneCol}
            </th>
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr key={row.athleteId} className="border-b border-card-line last:border-0">
              <th
                scope="row"
                className="sticky left-0 z-10 max-w-[124px] on-card bg-card py-1.5 pl-3 pr-1 text-left font-normal desktop:max-w-none desktop:px-3"
              >
                <Link
                  href={`/athletes/${row.athleteId}`}
                  className="flex min-h-11 items-center gap-2.5 text-inherit no-underline"
                >
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card-raised text-[12px] font-semibold max-desktop:hidden"
                  >
                    {row.initials}
                  </span>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="flex items-center gap-1 font-semibold desktop:whitespace-nowrap">
                      <span className="truncate">{row.name}</span>
                      {row.hasPain || row.activeInjury ? (
                        <TriangleAlert
                          aria-label={row.hasPain ? "Douleur signalée" : m.coach.activeInjury}
                          className={cn("size-4 shrink-0", row.hasPain ? "text-st-missed" : "text-st-partial")}
                        />
                      ) : null}
                    </span>
                    <span className="t-caption whitespace-nowrap font-normal text-soft max-desktop:hidden">
                      {row.groupNames.join(", ")}
                    </span>
                  </span>
                </Link>
              </th>
              {row.cells.map((cell) => (
                <td key={cell.sessionId} className="py-1.5 text-center desktop:px-1">
                  {cell.status ? (
                    <Link
                      href={`/seances/${cell.sessionId}/suivi#${row.athleteId}`}
                      aria-label={`${row.name}, ${m.status[cell.status]}`}
                      className="inline-flex size-11 items-center justify-center rounded-button hover:bg-raise"
                    >
                      <StatusIcon status={cell.status} />
                    </Link>
                  ) : (
                    <>
                      <span aria-hidden className="mx-auto block h-0.5 w-2 rounded-full bg-card-raised" />
                      <span className="sr-only">Non concerné</span>
                    </>
                  )}
                </td>
              ))}
              <td className="t-num whitespace-nowrap px-2 py-1.5 text-right text-[16px] desktop:px-3 desktop:text-[18px]">
                {row.completionPct === null ? "" : `${row.completionPct}\u00a0%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="border-t border-card-line px-3 py-2 desktop:px-3">
      <StatusLegend />
    </div>
  </div>
);
