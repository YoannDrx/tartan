"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { TrackingGrid } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/states";
import { cn } from "@/lib/cn";
import { RosterMore, RosterSearch, useRoster } from "@/features/tracking/roster";
import { WeekStrip } from "@/features/tracking/tracking-grid";

// Ce que la page envoie pour chaque athlète : des données, pas des lignes déjà rendues.
export type RosterAthlete = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  avatarPreset: string | null;
  level: string | null;
  otherGroups: string | null;
  hasAccount: boolean;
  watch: string | null;
  pain: boolean;
  completionPct: number | null;
  cells: TrackingGrid["rows"][number]["cells"] | null;
};
export type RosterSection = { key: string; name: string; detail: string | null; list: RosterAthlete[] };

const SEARCH_FROM = 12;

// La liste des athlètes, groupe par groupe. Un grand groupe se lit par tranches et se cherche par nom ; l'en-tête des
// colonnes reste sous la barre de l'application pendant le défilement.
export const AthleteRoster = ({
  sections,
  sessions,
  weekLabel,
}: {
  sections: RosterSection[];
  sessions: TrackingGrid["sessions"];
  weekLabel: string;
}) => {
  // Une seule suite, dans l'ordre des groupes : la tranche s'arrête au milieu d'un groupe s'il le faut.
  const all = sections.flatMap((section) => section.list.map((athlete) => ({ athlete, section: section.key })));
  const roster = useRoster(all, ({ athlete }) => `${athlete.firstName} ${athlete.lastName}`);
  const shown = new Set(roster.visible.map(({ athlete }) => athlete.id));
  return (
    <div className="flex flex-col gap-3">
      {all.length > SEARCH_FROM ? <RosterSearch roster={roster} total={all.length} /> : null}
      {/* `overflow-clip` et non `overflow-hidden` : les coins restent arrondis et l'en-tête peut coller à l'écran. */}
      <div className="overflow-clip rounded-card on-card bg-card">
        <table className="w-full border-separate border-spacing-0 desktop:table-fixed [&>tbody:last-of-type>tr:last-child>td]:border-b-0">
          <caption className="sr-only">{m.athletes.title}</caption>
          <thead className="max-tablet:sr-only">
            <tr className="[&>th]:sticky [&>th]:top-[calc(var(--offline-bar-height,0px)+58px)] [&>th]:z-10 [&>th]:border-b [&>th]:border-card-line [&>th]:bg-card">
              <th scope="col" className="t-col px-4 py-2 text-left">
                {m.coach.athleteCol}
              </th>
              <th scope="col" className="t-col w-32 px-3 py-2 text-left max-desktop:hidden">
                {m.athletes.levelCol}
              </th>
              <th scope="col" className="t-col w-52 px-3 py-2 text-left max-tablet:hidden">
                {m.athletes.thisWeekCol}
                <span className="sr-only">, {weekLabel}</span>
              </th>
              <th scope="col" className="t-col w-16 px-3 py-2 text-right tablet:w-20">
                {m.athletes.doneCol}
              </th>
              <th scope="col" className="t-col w-56 px-4 py-2 text-left max-desktop:hidden">
                {m.athletes.watchCol}
              </th>
            </tr>
          </thead>
          {sections.map((section) => {
            const list = section.list.filter((a) => shown.has(a.id));
            if (list.length === 0) return null;
            return (
              <tbody key={section.key}>
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={5}
                    className="border-b border-card-line bg-card-raised px-4 py-1.5 text-left font-normal"
                  >
                    <span className="t-section text-inherit">{section.name}</span>
                    <span className="t-caption ml-2 font-normal text-soft">
                      {m.athletes.groupCount(section.list.length)}
                      {section.detail ? `, ${section.detail}` : ""}
                    </span>
                  </th>
                </tr>
                {list.map((a) => (
                  <AthleteRow key={a.id} athlete={a} sessions={sessions} />
                ))}
              </tbody>
            );
          })}
        </table>
        <RosterMore roster={roster} />
      </div>
    </div>
  );
};

const AthleteRow = ({ athlete: a, sessions }: { athlete: RosterAthlete; sessions: TrackingGrid["sessions"] }) => (
  <tr className="group relative hover:bg-raise [&>td]:border-b [&>td]:border-card-line">
    <td className="px-4 py-2">
      <div className="flex items-center gap-3">
        <Avatar person={{ ...a, name: `${a.firstName} ${a.lastName}` }} size="sm" />
        <div className="min-w-0 flex-1">
          {/* La ligne entière ouvre la fiche ; le nom, lui, garde une cible de 44 px sans écarter les lignes. */}
          <Link
            href={`/athletes/${a.id}`}
            className="-my-3 block break-words py-3 font-semibold leading-snug text-inherit no-underline after:absolute after:inset-0"
          >
            {a.firstName} {a.lastName}
            {a.watch ? (
              <TriangleAlert
                aria-hidden
                className={cn(
                  "ml-1 inline size-4 align-[-2px] desktop:hidden",
                  a.pain ? "text-st-missed" : "text-st-partial",
                )}
              />
            ) : null}
            {a.watch ? <span className="sr-only desktop:hidden"> ({a.watch})</span> : null}
          </Link>
          <p className="t-caption break-words font-normal text-soft">
            {a.otherGroups}
            {a.otherGroups && a.level ? <span className="desktop:hidden">, </span> : null}
            {a.level ? <span className="desktop:hidden">{a.level}</span> : null}
          </p>
          {a.cells?.some((c) => c.status) ? (
            <div className="mt-1 tablet:hidden">
              <WeekStrip sessions={sessions} cells={a.cells} />
            </div>
          ) : null}
          {!a.hasAccount ? (
            <p className="mt-1 desktop:hidden">
              <Chip>{m.athletes.noAccount}</Chip>
            </p>
          ) : null}
        </div>
      </div>
    </td>
    <td className="px-3 py-2 text-soft max-desktop:hidden">{a.level ?? ""}</td>
    <td className="px-3 py-2 max-tablet:hidden">
      {a.cells && sessions.length > 0 ? (
        <WeekStrip sessions={sessions} cells={a.cells} />
      ) : (
        <span className="t-caption font-normal text-soft">{m.athletes.noSessionThisWeek}</span>
      )}
    </td>
    <td className="t-num whitespace-nowrap px-3 py-2 text-right text-[18px] align-top tablet:align-middle">
      {a.completionPct != null ? `${a.completionPct} %` : ""}
    </td>
    <td className="px-4 py-2 max-desktop:hidden">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {a.watch ? (
          <span
            className={cn("inline-flex items-center gap-1.5 t-caption", a.pain ? "text-st-missed" : "text-st-partial")}
          >
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            {a.watch}
          </span>
        ) : null}
        {!a.hasAccount ? <Chip>{m.athletes.noAccount}</Chip> : null}
      </div>
    </td>
  </tr>
);
