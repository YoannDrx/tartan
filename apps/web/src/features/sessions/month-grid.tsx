"use client";

import type { CellStatus, SessionType } from "@tartan/contracts";
import { monthRange, visibleDayItems } from "@tartan/domain";
import { capitalize, formatDateLong, formatWeekdayShort, m } from "@tartan/i18n";
import { Medal, PencilLine, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ActivityPicto } from "@/components/pictos";
import { StatusIcon } from "@/components/status-cell";
import { activityColors } from "@/lib/activity-colors";
import { cn } from "@/lib/cn";

export type MonthEntry = {
  id: string;
  date: string;
  title: string;
  type: SessionType;
  href: string;
  detail?: string;
  draft?: boolean;
  status?: CellStatus;
  progress?: string;
};

export type MonthCompetition = { id: string; date: string; name: string; action?: ReactNode };

const EntryLink = ({ entry, dense }: { entry: MonthEntry; dense: boolean }) => {
  const tint = activityColors(entry.type);
  return (
    <Link
      scroll={false}
      href={entry.href}
      draggable={Boolean(entry.progress !== undefined || entry.draft)}
      onDragStart={(e) => e.dataTransfer.setData("text/session-id", entry.id)}
      title={`${entry.title} · ${m.sessionType[entry.type]}`}
      style={{ backgroundColor: tint.background, color: tint.text }}
      className={cn(
        "flex items-center gap-1 rounded font-medium no-underline hover:underline",
        dense ? "mb-0.5 min-h-6 px-1 text-[12px]" : "min-h-11 gap-2 rounded-thumb px-2 leading-snug",
      )}
    >
      <ActivityPicto kind={entry.type} className={dense ? "size-3.5 shrink-0" : "size-4 shrink-0"} />
      <span className={cn("min-w-0 flex-1", dense ? "truncate" : "break-words")}>
        {entry.title}
        {!dense && entry.detail ? <span className="t-caption block font-normal">{entry.detail}</span> : null}
      </span>
      {entry.draft ? (
        <span className="shrink-0" title={m.calendar.draft}>
          <PencilLine aria-hidden className="size-3" />
          <span className="sr-only">{m.calendar.draft}</span>
        </span>
      ) : null}
      {entry.progress ? <span className="t-num shrink-0 tabular-nums">{entry.progress}</span> : null}
      {entry.status ? <StatusIcon status={entry.status} /> : null}
    </Link>
  );
};

const CompetitionRow = ({ competition, dense }: { competition: MonthCompetition; dense: boolean }) =>
  dense ? (
    <p className="mb-0.5 flex min-h-6 items-center gap-1 rounded border border-control-line px-1 text-[12px] font-semibold">
      <Medal aria-hidden className="size-3 shrink-0" />
      <span className="truncate">{competition.name}</span>
    </p>
  ) : (
    <div className="flex items-center gap-1.5 rounded-thumb border border-control-line p-2 t-caption">
      <Medal aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 break-words">{competition.name}</span>
      {competition.action}
    </div>
  );

// Le mois complet : grille détaillée sur ordinateur ; sur téléphone, grille compacte puis liste du jour touché.
export const MonthGrid = ({
  month,
  today,
  entries,
  competitions,
  newEntryHref,
  newEntryLabel,
  onMove,
}: {
  month: string;
  today: string;
  entries: MonthEntry[];
  competitions: MonthCompetition[];
  newEntryHref?: (day: string) => string;
  newEntryLabel?: (day: string) => string;
  onMove?: (id: string, day: string) => void;
}) => {
  const { cells } = monthRange(month);
  const days = useMemo(() => {
    const map = new Map<string, { entries: MonthEntry[]; competitions: MonthCompetition[] }>();
    for (const day of cells) map.set(day, { entries: [], competitions: [] });
    for (const entry of entries) map.get(entry.date)?.entries.push(entry);
    for (const competition of competitions) map.get(competition.date)?.competitions.push(competition);
    return map;
  }, [cells, entries, competitions]);
  const content = (day: string) => days.get(day) ?? { entries: [], competitions: [] };
  const firstBusy = cells.find(
    (day) => day.startsWith(month) && (content(day).entries.length > 0 || content(day).competitions.length > 0),
  );
  const [selected, setSelected] = useState(today.startsWith(month) ? today : (firstBusy ?? `${month}-01`));
  const selection = content(selected);
  const headers = cells.slice(0, 7);

  return (
    <>
      <div className="desktop:hidden">
        <div className="on-card overflow-hidden rounded-card bg-card">
          <div aria-hidden className="grid grid-cols-7 border-b border-card-line">
            {headers.map((day) => (
              <span key={day} className="t-col py-1.5 text-center">
                {formatWeekdayShort(day)}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day) => {
              const { entries: dayEntries, competitions: dayCompetitions } = content(day);
              const { visible, hidden } = visibleDayItems(dayEntries);
              const count = dayEntries.length + dayCompetitions.length;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelected(day)}
                  aria-pressed={selected === day}
                  // « 1er » n'annonce pas le « 1 » affiché : le chiffre visible reste dans le nom accessible.
                  aria-label={`${day.endsWith("-01") ? "1, " : ""}${capitalize(formatDateLong(day))}, ${m.calendar.dayCount(count)}`}
                  className={cn(
                    "flex min-h-14 min-w-0 flex-col items-center gap-1 py-1.5",
                    !day.startsWith(month) && "text-fg-muted",
                    selected === day && "bg-raise",
                  )}
                >
                  <span
                    className={cn(
                      "t-num flex size-6 items-center justify-center rounded-full text-[15px]",
                      day === today && "bg-accent text-on-accent",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  <span aria-hidden className="flex items-center gap-0.5">
                    {dayCompetitions.length > 0 ? <Medal className="size-2.5" /> : null}
                    {visible.map((entry) => (
                      <span
                        key={entry.id}
                        className="size-2 rounded-full"
                        style={{ backgroundColor: activityColors(entry.type).text }}
                      />
                    ))}
                    {hidden > 0 ? <span className="text-[10px] leading-none">+{hidden}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <section aria-live="polite" className="on-card mt-3 flex flex-col gap-1.5 rounded-card bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="t-caption font-semibold">{capitalize(formatDateLong(selected))}</h2>
            {newEntryHref ? (
              <Link
                href={newEntryHref(selected)}
                aria-label={newEntryLabel?.(selected)}
                className="inline-flex size-11 items-center justify-center rounded-button text-soft hover:bg-raise hover:text-fg"
              >
                <Plus aria-hidden className="size-4" />
              </Link>
            ) : null}
          </div>
          {selection.competitions.map((c) => (
            <CompetitionRow key={c.id} competition={c} dense={false} />
          ))}
          {selection.entries.map((entry) => (
            <EntryLink key={entry.id} entry={entry} dense={false} />
          ))}
          {selection.entries.length === 0 && selection.competitions.length === 0 ? (
            <p className="text-soft">{m.calendar.emptyDay}</p>
          ) : null}
        </section>
      </div>

      <div className="on-card overflow-hidden rounded-card bg-card max-desktop:hidden">
        <div aria-hidden className="grid grid-cols-7 border-b border-card-line">
          {headers.map((day) => (
            <span key={day} className="t-col px-2 py-1.5">
              {formatWeekdayShort(day)}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-card-line">
          {cells.map((day) => {
            const { entries: dayEntries, competitions: dayCompetitions } = content(day);
            return (
              <div
                key={day}
                aria-label={capitalize(formatDateLong(day))}
                role="group"
                onDragOver={onMove ? (e) => e.preventDefault() : undefined}
                onDrop={
                  onMove
                    ? (e) => {
                        const id = e.dataTransfer.getData("text/session-id");
                        if (id) onMove(id, day);
                      }
                    : undefined
                }
                className={cn("group min-h-28 min-w-0 bg-card p-1.5", !day.startsWith(month) && "text-fg-muted")}
              >
                <div className="mb-1 flex items-center justify-between">
                  <p
                    className={cn(
                      "t-num flex size-6 items-center justify-center rounded-full text-[16px]",
                      day === today && "bg-accent text-on-accent",
                    )}
                  >
                    {Number(day.slice(8))}
                  </p>
                  {newEntryHref ? (
                    <Link
                      href={newEntryHref(day)}
                      aria-label={newEntryLabel?.(day)}
                      className="inline-flex size-6 items-center justify-center rounded text-soft opacity-0 hover:bg-raise hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Plus aria-hidden className="size-3.5" />
                    </Link>
                  ) : null}
                </div>
                {dayCompetitions.map((c) => (
                  <CompetitionRow key={c.id} competition={c} dense />
                ))}
                {dayEntries.map((entry) => (
                  <EntryLink key={entry.id} entry={entry} dense />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
