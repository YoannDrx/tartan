"use client";

import type { CellStatus, SessionType } from "@tartan/contracts";
import { monthRange, visibleDayItems } from "@tartan/domain";
import { capitalize, formatDateLong, formatWeekdayShort, m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Lock, Medal, MoreHorizontal, PencilLine, Plus } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ActivityPicto } from "@/components/pictos";
import { StatusIcon } from "@/components/status-cell";
import { activityColors } from "@/lib/activity-colors";
import { cn } from "@/lib/cn";
import { dayClass, DropMarker, ForbiddenNote, type Planning } from "./planning-drag";

const t = w.planning;

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

const menuItem =
  "flex min-h-11 cursor-pointer items-center rounded-button px-3 outline-none data-[highlighted]:bg-card-raised";

// « Déplacer » et « Dupliquer » sans glisser : au clavier comme au doigt (WCAG 2.5.7). Une case du mois est
// trop étroite pour deux boutons : un seul ouvre les deux actions.
const EntryMenu = ({ entry, dense, planning }: { entry: MonthEntry; dense: boolean; planning: Planning }) => {
  const item = planning.item(entry);
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        data-plan-focus
        aria-label={t.actions(entry.title)}
        title={t.actions(entry.title)}
        // Dans une case, le bouton se pose sur la fin de la ligne, à sa couleur : il ne rogne pas le titre.
        style={dense ? { backgroundColor: activityColors(entry.type).background } : undefined}
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          dense
            ? // Montré au survol et au focus ; toujours là sur un écran tactile, où le survol n'existe pas.
              "absolute inset-y-0 right-0 min-h-6 w-6 rounded opacity-0 focus-visible:opacity-100 group-hover/entry:opacity-100 data-[state=open]:opacity-100 pointer-coarse:static pointer-coarse:opacity-100"
            : "size-11 rounded-button hover:bg-raise",
        )}
      >
        <MoreHorizontal aria-hidden className={dense ? "size-3.5" : "size-4"} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="menu-enter on-card z-50 w-56 max-w-[calc(100vw-16px)] rounded-card border border-card-line bg-card p-1.5 shadow-float-strong"
        >
          <DropdownMenu.Item className={menuItem} onSelect={() => planning.askMove(item)}>
            {t.moveItem}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuItem} onSelect={() => planning.askDuplicate(item)}>
            {t.duplicateItem}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

const Entry = ({ entry, dense, planning }: { entry: MonthEntry; dense: boolean; planning?: Planning }) => {
  const tint = activityColors(entry.type);
  const item = planning?.item(entry);
  const held = planning?.held(entry.id) ?? false;
  return (
    <div
      {...(planning && item ? planning.card(item) : {})}
      // Pendant le glisser, la séance reste à sa place, atténuée, dans un cadre en pointillés.
      style={held ? { color: tint.text } : { backgroundColor: tint.background, color: tint.text }}
      className={cn(
        "group/entry relative flex min-w-0 items-center font-medium",
        dense ? "mb-0.5 min-h-6 rounded text-[12px]" : "min-h-11 rounded-thumb leading-snug",
        planning && "select-none [-webkit-touch-callout:none]",
        planning && !item?.locked && "cursor-grab",
        // Le menu de la ligne que l'on tient ne sert à rien : il s'efface avec elle.
        held &&
          "cursor-grabbing outline-1 -outline-offset-1 outline-dashed outline-control-line *:opacity-40 [&>[data-plan-focus]]:invisible",
      )}
    >
      <Link
        scroll={false}
        draggable={false}
        href={entry.href}
        title={`${entry.title} · ${m.sessionType[entry.type]}`}
        className={cn(
          "flex min-w-0 flex-1 items-center self-stretch text-inherit no-underline hover:underline",
          dense ? "gap-1 px-1" : "gap-2 px-2",
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
      {planning && item?.locked ? (
        <span
          className={cn("inline-flex shrink-0 items-center justify-center", dense ? "size-6" : "size-11")}
          title={t.readOnlyHint(entry.title)}
        >
          <Lock aria-hidden className="size-3.5" />
          <span className="sr-only">{t.readOnly}</span>
        </span>
      ) : planning ? (
        <EntryMenu entry={entry} dense={dense} planning={planning} />
      ) : null}
    </div>
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
// Avec `planning` (le coach), une séance se glisse d'un jour à l'autre, ou se déplace par son menu.
export const MonthGrid = ({
  month,
  today,
  entries,
  competitions,
  newEntryHref,
  newEntryLabel,
  planning,
}: {
  month: string;
  today: string;
  entries: MonthEntry[];
  competitions: MonthCompetition[];
  newEntryHref?: (day: string) => string;
  newEntryLabel?: (day: string) => string;
  planning?: Planning;
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
  // Sur téléphone, la liste suit la séance : elle ouvre le jour où elle vient de se poser (ou de revenir).
  const landed = planning?.landed ?? null;
  const [followed, setFollowed] = useState(landed);
  if (landed !== followed) {
    setFollowed(landed);
    if (landed && days.has(landed.day)) setSelected(landed.day);
  }
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
              const state = planning?.dayState(day) ?? null;
              const marker = planning?.markerAt(day) ?? -1;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelected(day)}
                  aria-pressed={selected === day}
                  {...planning?.day(day)}
                  // « 1er » n'annonce pas le « 1 » affiché : le chiffre visible reste dans le nom accessible.
                  aria-label={`${day.endsWith("-01") ? "1, " : ""}${capitalize(formatDateLong(day))}, ${m.calendar.dayCount(count)}`}
                  className={cn(
                    "flex min-h-14 min-w-0 flex-col items-center gap-1 py-1.5 transition-colors",
                    !day.startsWith(month) && "text-fg-muted",
                    selected === day && "bg-raise",
                    dayClass(state),
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
                    {state === "locked" ? <ForbiddenNote compact /> : null}
                    {dayCompetitions.length > 0 ? <Medal className="size-2.5" /> : null}
                    {visible.map((entry, index) => (
                      <Fragment key={entry.id}>
                        {marker === index ? <IncomingDot /> : null}
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: activityColors(entry.type).text }}
                        />
                      </Fragment>
                    ))}
                    {marker >= visible.length ? <IncomingDot /> : null}
                    {hidden > 0 ? <span className="text-[12px] leading-none">+{hidden}</span> : null}
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
            <Entry key={entry.id} entry={entry} dense={false} planning={planning} />
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
            const state = planning?.dayState(day) ?? null;
            const marker = planning?.markerAt(day) ?? -1;
            return (
              <div
                key={day}
                aria-label={capitalize(formatDateLong(day))}
                role="group"
                {...planning?.day(day)}
                className={cn(
                  "group min-h-28 min-w-0 bg-card p-1.5 transition-colors",
                  !day.startsWith(month) && "text-fg-muted",
                  dayClass(state),
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-1">
                  <p
                    className={cn(
                      "t-num flex size-6 shrink-0 items-center justify-center rounded-full text-[16px]",
                      day === today && "bg-accent text-on-accent",
                    )}
                  >
                    {Number(day.slice(8))}
                  </p>
                  {state === "locked" ? <ForbiddenNote /> : null}
                  {newEntryHref ? (
                    <Link
                      href={newEntryHref(day)}
                      aria-label={newEntryLabel?.(day)}
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded text-soft opacity-0 hover:bg-raise hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Plus aria-hidden className="size-3.5" />
                    </Link>
                  ) : null}
                </div>
                {dayCompetitions.map((c) => (
                  <CompetitionRow key={c.id} competition={c} dense />
                ))}
                {dayEntries.map((entry, index) => (
                  <Fragment key={entry.id}>
                    <DropMarker show={marker === index} />
                    <Entry entry={entry} dense planning={planning} />
                  </Fragment>
                ))}
                <DropMarker show={marker === dayEntries.length} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

// Sur la grille compacte, la séance qui arrive se lit comme une pastille en pointillés, à son rang du jour.
const IncomingDot = () => <span data-plan-marker className="size-2 rounded-full border border-dashed border-accent" />;
