import { Plus, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { startOfWeek } from "@tartan/domain";
import { formatDayMonth, m } from "@tartan/i18n";
import { Sheet } from "@/components/sheet";
import { Chip, EmptyState, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { todayIso } from "@/lib/dates";
import { AthleteDialog } from "@/features/athletes/athlete-forms";
import { requireStaffSpace } from "@/features/shell/space";
import { WeekStrip } from "@/features/tracking/tracking-grid";
import { requireOrgMember } from "@/server/access";
import { listAthletes } from "@/server/athlete.service";
import { listGroups } from "@/server/org.service";
import { getTrackingGrid } from "@/server/tracking.service";

export const metadata: Metadata = { title: m.athletes.title };

export default async function AthletesPage() {
  const { actor, organizationId } = await requireStaffSpace();
  const access = await requireOrgMember(actor.userId, organizationId, "viewTracking");
  const week = startOfWeek(todayIso());
  const [athletes, groups, grid] = await Promise.all([
    listAthletes(actor.userId, organizationId),
    listGroups(access),
    getTrackingGrid(actor.userId, organizationId, { week }),
  ]);
  const canManage = access.role !== "assistant";
  const weekRows = new Map(grid.rows.map((row) => [row.athleteId, row]));

  // Liste de départ : chaque athlète une seule fois, sous le premier de ses groupes.
  const placed = new Set<string>();
  const sections = groups.map((group) => {
    const list = athletes.filter((a) => !placed.has(a.id) && a.groups.some((g) => g.id === group.id));
    for (const a of list) placed.add(a.id);
    return { key: group.id, name: group.name, detail: group.goal ?? group.level, list };
  });
  const rest = athletes.filter((a) => !placed.has(a.id));
  if (rest.length > 0) sections.push({ key: "none", name: m.athletes.noGroup, detail: null, list: rest });

  const addButton = (
    <Button size="sm">
      <Plus aria-hidden className="size-5" />
      {m.athletes.new}
    </Button>
  );
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={m.athletes.title}
        detail={athletes.length > 0 ? m.athletes.summary(athletes.length, groups.length) : undefined}
        actions={canManage ? <AthleteDialog trigger={addButton} groups={groups} title={m.athletes.new} /> : null}
      />
      {athletes.length === 0 ? (
        <EmptyState
          rubric="athletes"
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/reglages#invitations">{m.home.inviteAthletes}</Link>
            </Button>
          }
        >
          {m.athletes.empty}
        </EmptyState>
      ) : (
        <Sheet>
          <table className="w-full border-collapse desktop:table-fixed">
            <caption className="sr-only">{m.athletes.title}</caption>
            <thead className="max-tablet:sr-only">
              <tr>
                <th scope="col" className="t-col px-4 py-2 text-left">
                  {m.coach.athleteCol}
                </th>
                <th scope="col" className="t-col w-32 px-3 py-2 text-left max-desktop:hidden">
                  {m.athletes.levelCol}
                </th>
                <th scope="col" className="t-col w-44 px-3 py-2 text-left max-tablet:hidden">
                  {m.athletes.thisWeekCol}
                  <span className="sr-only">, {m.coach.weekOf(formatDayMonth(week))}</span>
                </th>
                <th scope="col" className="t-col w-16 px-3 py-2 text-right tablet:w-20">
                  {m.athletes.doneCol}
                </th>
                <th scope="col" className="t-col w-56 px-4 py-2 text-left max-desktop:hidden">
                  {m.athletes.watchCol}
                </th>
              </tr>
            </thead>
            {sections
              .filter((section) => section.list.length > 0)
              .map((section) => (
                <tbody key={section.key}>
                  <tr>
                    <th
                      scope="rowgroup"
                      colSpan={5}
                      className="border-y border-card-line bg-card-raised px-4 py-1.5 text-left font-normal"
                    >
                      <span className="t-section text-inherit">{section.name}</span>
                      <span className="t-caption ml-2 font-normal text-soft">
                        {m.athletes.groupCount(section.list.length)}
                        {section.detail ? `, ${section.detail}` : ""}
                      </span>
                    </th>
                  </tr>
                  {section.list.map((a) => {
                    const row = weekRows.get(a.id);
                    const watch = row?.hasPain
                      ? m.athletes.painReported
                      : row?.activeInjury
                        ? `${m.coach.activeInjury} : ${m.bodyArea[row.activeInjury as keyof typeof m.bodyArea].toLowerCase()}`
                        : null;
                    return (
                      <tr key={a.id} className="group relative border-b border-card-line last:border-0 hover:bg-raise">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-3">
                            <span
                              aria-hidden
                              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card-raised text-[12px] font-semibold max-tablet:hidden"
                            >
                              {`${a.firstName[0] ?? ""}${a.lastName[0] ?? ""}`.toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/athletes/${a.id}`}
                                className="block break-words font-semibold leading-snug text-inherit no-underline after:absolute after:inset-0"
                              >
                                {a.firstName} {a.lastName}
                                {watch ? (
                                  <TriangleAlert
                                    aria-hidden
                                    className={cn(
                                      "ml-1 inline size-4 align-[-2px] desktop:hidden",
                                      row?.hasPain ? "text-st-missed" : "text-st-partial",
                                    )}
                                  />
                                ) : null}
                                {watch ? <span className="sr-only desktop:hidden"> ({watch})</span> : null}
                              </Link>
                              <p className="t-caption break-words font-normal text-soft">
                                {a.groups.length > 1 ? a.groups.map((g) => g.name).join(", ") : null}
                                {a.groups.length > 1 && a.level ? <span className="desktop:hidden">, </span> : null}
                                {a.level ? <span className="desktop:hidden">{a.level}</span> : null}
                              </p>
                              {row?.cells.some((c) => c.status) ? (
                                <div className="mt-1 tablet:hidden">
                                  <WeekStrip sessions={grid.sessions} cells={row.cells} />
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
                          {row && grid.sessions.length > 0 ? (
                            <WeekStrip sessions={grid.sessions} cells={row.cells} />
                          ) : (
                            <span className="t-caption font-normal text-soft">{m.athletes.noSessionThisWeek}</span>
                          )}
                        </td>
                        <td className="t-num whitespace-nowrap px-3 py-2 text-right text-[18px] align-top tablet:align-middle">
                          {row?.completionPct != null ? `${row.completionPct} %` : ""}
                        </td>
                        <td className="px-4 py-2 max-desktop:hidden">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {watch ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 t-caption",
                                  row?.hasPain ? "text-st-missed" : "text-st-partial",
                                )}
                              >
                                <TriangleAlert aria-hidden className="size-4 shrink-0" />
                                {watch}
                              </span>
                            ) : null}
                            {!a.hasAccount ? <Chip>{m.athletes.noAccount}</Chip> : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
          </table>
        </Sheet>
      )}
    </div>
  );
}
