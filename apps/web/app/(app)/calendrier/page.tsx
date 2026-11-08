import { isoDate } from "@tartan/contracts";
import { newSessionHref } from "@/lib/session-navigation";
import { BatchPublication } from "@/features/sessions/batch-publication";
import { Medal, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { addDays, startOfWeek } from "@tartan/domain";
import { capitalize, formatDateLong, formatDayMonth, m } from "@tartan/i18n";
import { FilterPill } from "@/components/filter-pill";
import { Sheet } from "@/components/sheet";
import { PageHeader, PeriodStepper } from "@/components/states";
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
import { CalendarPhases } from "@/features/phases/calendar-phases";

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
      <Link
        href={`/seance/${s.id}`}
        className="grid min-h-11 grid-cols-[26px_minmax(0,1fr)] items-center gap-x-3 px-4 py-2 text-inherit no-underline hover:bg-raise"
      >
        <StatusIcon status={s.status} />
        <span className="flex min-w-0 flex-col leading-snug">
          <span className="break-words font-semibold">{s.title}</span>
          <span className="t-caption font-normal text-soft">
            {capitalize(formatDateLong(s.date))}, {m.variant[s.variant].toLowerCase()}
          </span>
        </span>
      </Link>
    </li>
  );
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title={m.nav.calendrier} />
      <CalendarPhases ctx={ctx} from={today} to={addDays(today, 42)} today={today} />
      <Sheet>
        {competitions.length > 0 ? (
          <section>
            <h2 className="t-col border-b border-card-line bg-card-raised px-4 py-1.5">
              {m.athleteCalendar.competitions}
            </h2>
            <ul className="divide-y divide-card-line">
              {competitions.map((c) => (
                <li
                  key={c.id}
                  className="grid grid-cols-[26px_minmax(0,1fr)] items-center gap-x-3 px-4 py-2 leading-snug"
                >
                  <Medal aria-hidden className="size-5 justify-self-center" />
                  <span className="min-w-0">
                    <span className="block break-words font-semibold">{c.name}</span>
                    <span className="t-caption block font-normal text-soft">
                      {capitalize(formatDateLong(c.date))}
                      {c.location ? `, ${c.location}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section>
          <h2 className="t-col border-y border-card-line bg-card-raised px-4 py-1.5 first:border-t-0">
            {m.athleteCalendar.upcoming}
          </h2>
          {upcoming.length ? (
            <ul className="divide-y divide-card-line">{upcoming.map(row)}</ul>
          ) : (
            <p className="px-4 py-3 text-soft">{m.today.noneYet}</p>
          )}
        </section>
        {past.length ? (
          <section>
            <h2 className="t-col border-y border-card-line bg-card-raised px-4 py-1.5">{m.athleteCalendar.past}</h2>
            <ul className="divide-y divide-card-line">{past.map(row)}</ul>
          </section>
        ) : null}
      </Sheet>
    </div>
  );
};

export default async function CalendrierPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireSpace();
  if (!ctx.staff) return <AthleteCalendar ctx={ctx} />;
  const params = await searchParams;
  const today = todayIso();
  const isMonth = params.vue === "mois";
  const selectedWeek = isoDate.safeParse(params.semaine).success ? params.semaine : undefined;
  const selectedMonth =
    params.mois && /^\d{4}-\d{2}$/.test(params.mois) && isoDate.safeParse(`${params.mois}-01`).success
      ? params.mois
      : undefined;
  const month = selectedMonth ?? (selectedWeek ?? today).slice(0, 7);
  const week = startOfWeek(selectedWeek ?? (isMonth && selectedMonth ? `${selectedMonth}-01` : today));
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
        actions={
          <>
            <BatchPublication
              key={`${ctx.organizationId}:${from}:${to}:${params.groupe ?? "all"}`}
              sessions={data.sessions.filter((s) => (isMonth ? s.date.startsWith(month) : true))}
            />
            <CompetitionDialog athletes={athletes} today={today} />
            {!isMonth ? <DuplicateWeekDialog week={week} groups={groups} /> : null}
            {ctx.space.aiPlannerEnabled ? (
              <Button asChild variant="secondary" size="sm">
                <Link
                  href={`/planificateur?date=${isMonth ? today : week}${params.groupe ? `&groupe=${encodeURIComponent(params.groupe)}` : ""}`}
                  prefetch={false}
                >
                  {m.aiPlanner.title}
                </Link>
              </Button>
            ) : null}
            <Button asChild size="sm" className="order-first desktop:order-none">
              <Link
                href={newSessionHref({
                  date: isMonth ? `${month}-01` : week,
                  groupId: params.groupe,
                  returnTo: href({}),
                })}
              >
                <Plus aria-hidden className="size-5" />
                {m.coach.newSession}
              </Link>
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <PeriodStepper
          label={label}
          previous={isMonth ? href({ mois: shiftMonth(-1) }) : href({ semaine: addDays(week, -7) })}
          next={isMonth ? href({ mois: shiftMonth(1) }) : href({ semaine: addDays(week, 7) })}
          previousLabel="Période précédente"
          nextLabel="Période suivante"
        />
        <nav
          aria-label="Vue et groupe"
          className="flex max-w-full gap-2 overflow-x-auto py-1 desktop:flex-wrap desktop:overflow-visible"
        >
          <FilterPill href={href({ vue: undefined, mois: undefined, semaine: week })} active={!isMonth}>
            {m.calendar.week}
          </FilterPill>
          <FilterPill href={href({ vue: "mois", semaine: undefined, mois: month })} active={isMonth}>
            {m.calendar.month}
          </FilterPill>
          {groups.length > 1 ? <span aria-hidden className="mx-1 w-px self-stretch bg-card-line" /> : null}
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
      </div>
      <CalendarPhases ctx={ctx} from={from} to={to} today={today} groupId={params.groupe} />
      {isMonth ? (
        <MonthBoard month={month} today={today} data={data} returnTo={href({})} />
      ) : (
        <WeekBoard week={week} today={today} data={data} returnTo={href({})} groupId={params.groupe} />
      )}
    </div>
  );
}
