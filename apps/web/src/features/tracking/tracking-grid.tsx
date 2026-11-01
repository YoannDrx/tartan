import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { TrackingGrid } from "@tartan/contracts";
import { formatWeekdayShort, m } from "@tartan/i18n";
import { StatusIcon } from "@/components/status-cell";
import { cn } from "@/lib/cn";

// La grille est l'écran de travail du coach : des lignes denses plutôt que des cartes.
export const TrackingTable = ({ grid }: { grid: TrackingGrid }) => (
  <div className="overflow-x-auto rounded-block border border-border bg-surface">
    <table className="w-full min-w-max border-collapse">
      <caption className="sr-only">{m.coach.trackingTitle}</caption>
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left t-section">
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
                className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center rounded-button leading-tight text-ink no-underline hover:bg-bg"
              >
                <span className="t-caption font-semibold">{formatWeekdayShort(s.date)}</span>
                <span className="text-[12px] text-muted max-desktop:hidden">{m.sessionType[s.type]}</span>
              </Link>
            </th>
          ))}
          <th scope="col" className="w-11 px-2 py-2 text-right t-caption text-muted desktop:w-14 desktop:px-3">
            {m.coach.doneCol}
          </th>
        </tr>
      </thead>
      <tbody>
        {grid.rows.map((row) => (
          <tr key={row.athleteId} className="border-b border-border last:border-0">
            <th
              scope="row"
              className="sticky left-0 z-10 max-w-[124px] bg-surface py-1.5 pl-3 pr-1 text-left font-normal desktop:max-w-none desktop:px-3"
            >
              <Link
                href={`/athletes/${row.athleteId}`}
                className="flex min-h-11 items-center gap-2.5 text-ink no-underline"
              >
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunk text-[12px] font-semibold max-desktop:hidden"
                >
                  {row.initials}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="flex items-center gap-1 font-semibold desktop:whitespace-nowrap">
                    <span className="truncate">{row.name}</span>
                    {row.hasPain || row.activeInjury ? (
                      <TriangleAlert
                        aria-label={row.hasPain ? "Douleur signalée" : m.coach.activeInjury}
                        className={cn("size-4 shrink-0", row.hasPain ? "text-brand-strong" : "text-warning-strong")}
                      />
                    ) : null}
                  </span>
                  <span className="t-caption whitespace-nowrap font-normal text-muted max-desktop:hidden">
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
                    className="inline-flex size-11 items-center justify-center rounded-button hover:bg-bg"
                  >
                    <StatusIcon status={cell.status} />
                  </Link>
                ) : (
                  <span className="sr-only">Non concerné</span>
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
);
