import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { startOfWeek } from "@tartan/domain";
import { formatDayMonth, m } from "@tartan/i18n";
import { EmptyState, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { todayIso } from "@/lib/dates";
import { AthleteDialog } from "@/features/athletes/athlete-forms";
import { AthleteRoster, type RosterAthlete, type RosterSection } from "@/features/athletes/athlete-roster";
import { requireStaffSpace } from "@/features/shell/space";
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

  // La liste part en données vers le navigateur, qui la rend par tranches : la page ne pèse plus le poids du groupe.
  const toRow = (a: (typeof athletes)[number]): RosterAthlete => {
    const row = weekRows.get(a.id);
    return {
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      avatarUrl: a.avatarUrl,
      avatarPreset: a.avatarPreset,
      level: a.level,
      otherGroups: a.groups.length > 1 ? a.groups.map((g) => g.name).join(", ") : null,
      hasAccount: a.hasAccount,
      watch: row?.hasPain
        ? m.athletes.painReported
        : row?.activeInjury
          ? `${m.coach.activeInjury} : ${m.bodyArea[row.activeInjury as keyof typeof m.bodyArea].toLowerCase()}`
          : null,
      pain: Boolean(row?.hasPain),
      completionPct: row?.completionPct ?? null,
      cells: row?.cells ?? null,
    };
  };
  // Liste de départ : chaque athlète une seule fois, sous le premier de ses groupes.
  const placed = new Set<string>();
  const sections: RosterSection[] = groups.map((group) => {
    const list = athletes.filter((a) => !placed.has(a.id) && a.groups.some((g) => g.id === group.id));
    for (const a of list) placed.add(a.id);
    return { key: group.id, name: group.name, detail: group.goal ?? group.level, list: list.map(toRow) };
  });
  const rest = athletes.filter((a) => !placed.has(a.id));
  if (rest.length > 0) sections.push({ key: "none", name: m.athletes.noGroup, detail: null, list: rest.map(toRow) });

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
              <Link href="/reglages/membres#inviter">{m.home.inviteAthletes}</Link>
            </Button>
          }
        >
          {m.athletes.empty}
        </EmptyState>
      ) : (
        <AthleteRoster sections={sections} sessions={grid.sessions} weekLabel={m.coach.weekOf(formatDayMonth(week))} />
      )}
    </div>
  );
}
