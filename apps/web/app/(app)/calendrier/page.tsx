import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { addDays, startOfWeek } from "@tartan/domain";
import { capitalize, formatDateLong, formatDayMonth, m } from "@tartan/i18n";
import { FilterPill } from "@/components/filter-pill";
import { EmptyState, PageHeader } from "@/components/states";
import { StatusIcon } from "@/components/status-cell";
import { Button } from "@/components/ui/button";
import { todayIso } from "@/lib/dates";
import { CompetitionDialog, DuplicateWeekDialog } from "@/features/sessions/calendar-tools";
import { MonthBoard, WeekBoard } from "@/features/sessions/calendar-board";
import { requireSpace, type SpaceContext } from "@/features/shell/space";
import { requireOrgMember } from "@/server/access";
import { getAthleteCalendar } from "@/server/athlete-view.service";
import { listAthletes } from "@/server/athlete.service";
import { listGroups } from "@/server/org.service";
import { listCalendar } from "@/server/session.service";

export const metadata: Metadata = { title: m.nav.calendrier };

type Search = { vue?: string; semaine?: string; mois?: string; groupe?: string };

const AthleteCalendar = async ({ ctx }: { ctx: SpaceContext }) => {
  const today = todayIso();
  const { sessions, competitions } = await getAthleteCalendar(ctx.actor.userId, ctx.organizationId, {
    from: addDays(today, -28),
    to: addDays(today, 42),
  });
  const upcoming = sessions.filter((s) => s.date >= today);
  const past = sessions.filter((s) => s.date < today).reverse();
  const row = (s: (typeof sessions)[number]) => (
    <li key={s.id}>
      <Link href={`/seance/${s.id}`} className="flex min-h-11 items-center gap-3 p-3 text-ink no-underline hover:bg-bg">
        <StatusIcon status={s.status} />
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">{s.title}</span>
          <span className="t-caption font-normal text-muted">
            {capitalize(formatDateLong(s.date))}, {m.variant[s.variant].toLowerCase()}
          </span>
        </span>
      </Link>
    </li>
  );
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={m.nav.calendrier} />
      {competitions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="t-section">Compétitions</h2>
          <ul className="divide-y divide-border rounded-block border border-border bg-surface">
            {competitions.map((c) => (
              <li key={c.id} className="p-3">
                <span className="font-semibold">{c.name}</span>
                <span className="t-caption block font-normal text-muted">
                  {capitalize(formatDateLong(c.date))}
                  {c.location ? `, ${c.location}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="flex flex-col gap-2">
        <h2 className="t-section">À venir</h2>
        {upcoming.length ? (
          <ul className="divide-y divide-border rounded-block border border-border bg-surface">{upcoming.map(row)}</ul>
        ) : (
          <EmptyState>{m.today.noneYet}</EmptyState>
        )}
      </section>
      {past.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="t-section">Passées</h2>
          <ul className="divide-y divide-border rounded-block border border-border bg-surface">{past.map(row)}</ul>
        </section>
      ) : null}
    </div>
  );
};

export default async function CalendrierPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireSpace();
  if (!ctx.staff) return <AthleteCalendar ctx={ctx} />;
  const params = await searchParams;
  const today = todayIso();
  const isMonth = params.vue === "mois";
  const week = startOfWeek(params.semaine && /^\d{4}-\d{2}-\d{2}$/.test(params.semaine) ? params.semaine : today);
  const month = params.mois && /^\d{4}-\d{2}$/.test(params.mois) ? params.mois : today.slice(0, 7);
  const monthDate = new Date(`${month}-15T12:00:00Z`);
  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + delta, 15));
    return d.toISOString().slice(0, 7);
  };
  const access = await requireOrgMember(ctx.actor.userId, ctx.organizationId, "viewTracking");
  const from = isMonth ? addDays(`${month}-01`, -7) : week;
  const to = isMonth ? addDays(`${month}-01`, 42) : addDays(week, 6);
  const [data, groups, athletes] = await Promise.all([
    listCalendar(ctx.actor.userId, ctx.organizationId, { from, to, groupId: params.groupe }),
    listGroups(access),
    listAthletes(ctx.actor.userId, ctx.organizationId),
  ]);
  const href = (next: Search) => {
    const q = new URLSearchParams();
    const merged = {
      vue: isMonth ? "mois" : undefined,
      semaine: isMonth ? undefined : week,
      mois: isMonth ? month : undefined,
      groupe: params.groupe,
      ...next,
    };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/calendrier?${q.toString()}`;
  };
  const label = isMonth
    ? capitalize(
        new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthDate),
      )
    : m.coach.weekOf(formatDayMonth(week));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={m.nav.calendrier}
        detail={label}
        actions={
          <>
            <Link
              href={isMonth ? href({ mois: shiftMonth(-1) }) : href({ semaine: addDays(week, -7) })}
              aria-label="Période précédente"
              className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface text-ink hover:bg-bg"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </Link>
            <Link
              href={isMonth ? href({ mois: shiftMonth(1) }) : href({ semaine: addDays(week, 7) })}
              aria-label="Période suivante"
              className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface text-ink hover:bg-bg"
            >
              <ChevronRight aria-hidden className="size-5" />
            </Link>
            <CompetitionDialog athletes={athletes} today={today} />
            {!isMonth ? <DuplicateWeekDialog week={week} groups={groups} /> : null}
            <Button asChild size="sm">
              <Link href="/seances/nouvelle">
                <Plus aria-hidden className="size-5" />
                {m.coach.newSession}
              </Link>
            </Button>
          </>
        }
      />
      <nav aria-label="Vue et groupe" className="flex flex-wrap gap-2">
        <FilterPill href={href({ vue: undefined, mois: undefined, semaine: week })} active={!isMonth}>
          {m.calendar.week}
        </FilterPill>
        <FilterPill href={href({ vue: "mois", semaine: undefined, mois: month })} active={isMonth}>
          {m.calendar.month}
        </FilterPill>
        {groups.length > 1 ? <span aria-hidden className="mx-1 w-px self-stretch bg-border" /> : null}
        {groups.length > 1 ? (
          <FilterPill href={href({ groupe: undefined })} active={!params.groupe}>
            {m.coach.allGroups}
          </FilterPill>
        ) : null}
        {groups.length > 1
          ? groups.map((g) => (
              <FilterPill key={g.id} href={href({ groupe: g.id })} active={params.groupe === g.id}>
                {g.name}
              </FilterPill>
            ))
          : null}
      </nav>
      {isMonth ? (
        <MonthBoard month={month} today={today} data={data} />
      ) : (
        <WeekBoard week={week} today={today} data={data} />
      )}
    </div>
  );
}
