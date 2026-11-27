import { CalendarDetailPanel } from "@/features/sessions/calendar-detail-panel";
import { SessionFollowupContent } from "@/features/tracking/session-detail";
import { isoDate, uuid, type CalendarSession } from "@tartan/contracts";
import { newSessionHref } from "@/lib/session-navigation";
import { BatchPublication } from "@/features/sessions/batch-publication";
import { Medal, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { addDays, defaultDateForWeek, monthRange, shiftMonthKey, startOfWeek } from "@tartan/domain";
import { capitalize, formatDateLong, formatDayMonth, m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { FilterPill } from "@/components/filter-pill";
import { Sheet } from "@/components/sheet";
import { PageHeader, PeriodStepper } from "@/components/states";
import { StatusIcon } from "@/components/status-cell";
import { Button } from "@/components/ui/button";
import { todayIso } from "@/lib/dates";
import { CompetitionDialog, DuplicateWeekDialog } from "@/features/sessions/calendar-tools";
import { ListBoard, MonthBoard, WeekBoard } from "@/features/sessions/calendar-board";
import { CalendarViewPill } from "@/features/sessions/calendar-view-switch";
import { MonthGrid } from "@/features/sessions/month-grid";
import { getCalendarView } from "@/server/me.service";
import { requireSpace, type SpaceContext } from "@/features/shell/space";
import { requireOrgMember } from "@/server/access";
import { getAthleteCalendar } from "@/server/athlete-view.service";
import { listAthletes } from "@/server/athlete.service";
import { listGroups } from "@/server/org.service";
import { listPlanning } from "@/server/session.service";
import { canOpenNotebook } from "@/server/personal-space.service";
import { NOTEBOOK_FOR_PLANNER } from "@/lib/onboarding-paths";
import { CalendarPhases } from "@/features/phases/calendar-phases";

export const metadata: Metadata = { title: m.nav.calendrier };

type Search = { vue?: string; semaine?: string; mois?: string; groupe?: string; seance?: string };

const validMonth = (value?: string) =>
  value && /^\d{4}-\d{2}$/.test(value) && isoDate.safeParse(`${value}-01`).success ? value : undefined;

const monthLabel = (month: string) =>
  capitalize(
    new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${month}-15T12:00:00Z`),
    ),
  );

async function athleteAgenda(ctx: SpaceContext, range: { from: string; to: string }) {
  const notebook = ctx.spaces.find((s) => s.kind === "personal" && s.organizationId !== ctx.organizationId);
  const [club, personal, planning] = await Promise.all([
    getAthleteCalendar(ctx.actor.userId, ctx.organizationId, range),
    notebook ? getAthleteCalendar(ctx.actor.userId, notebook.organizationId, range) : null,
    notebook ? listPlanning(ctx.actor.userId, notebook.organizationId, { ...range, summary: true }) : null,
  ]);
  const sessions = [
    ...club.sessions.map((s) => ({ ...s, source: m.brand.clubSession })),
    ...(personal?.sessions ?? []).map((s) => ({ ...s, source: m.brand.personalSession })),
    ...(planning?.sessions ?? [])
      .filter((s) => !s.publishedAt)
      .map((s) => ({ ...s, variant: null, status: undefined, source: m.brand.personalSession })),
  ];
  sessions.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  return { sessions, competitions: club.competitions };
}

const AthleteMonth = async ({ ctx, month, today }: { ctx: SpaceContext; month: string; today: string }) => {
  const range = monthRange(month);
  const { sessions, competitions } = await athleteAgenda(ctx, range);
  return (
    <>
      <PeriodStepper
        label={monthLabel(month)}
        previous={`/calendrier?vue=mois&mois=${shiftMonthKey(month, -1)}`}
        next={`/calendrier?vue=mois&mois=${shiftMonthKey(month, 1)}`}
        previousLabel={m.calendar.previousMonth}
        nextLabel={m.calendar.nextMonth}
      />
      <CalendarPhases ctx={ctx} from={range.from} to={range.to} today={today} />
      <MonthGrid
        key={month}
        month={month}
        today={today}
        entries={sessions.map((s) => ({
          id: s.id,
          date: s.date,
          title: s.title,
          type: s.type,
          href: s.status ? `/seance/${s.id}` : `/seances/${s.id}`,
          draft: !s.status,
          status: s.status,
          detail: [
            s.source,
            s.startTime?.replace(":", " h "),
            s.variant ? m.variant[s.variant].toLowerCase() : w.personal.calendar.draft,
          ]
            .filter(Boolean)
            .join(", "),
        }))}
        competitions={competitions}
      />
    </>
  );
};

// Espace personnel : une séance du calendrier, sans suivi de groupe. Brouillon, elle se modifie ; publiée, elle
// s'ouvre pour être faite et validée.
const PersonalSessionPanel = ({ session }: { session?: CalendarSession }) =>
  session ? (
    <section aria-labelledby="seance-perso" className="flex flex-col gap-3">
      <h2 id="seance-perso" className="t-h1 text-balance">
        {session.title}
      </h2>
      <p>{capitalize(formatDateLong(session.date))}</p>
      <p className="t-caption font-normal text-soft">
        {session.publishedAt ? w.personal.calendar.published : w.personal.calendar.draft}
      </p>
      {session.publishedAt ? (
        <Button asChild size="lg" className="tablet:self-start">
          <Link href={`/seance/${session.id}`}>{w.personal.calendar.open}</Link>
        </Button>
      ) : null}
    </section>
  ) : null;

const AthleteCalendar = async ({ ctx, params }: { ctx: SpaceContext; params: Search }) => {
  const today = todayIso();
  const preference = await getCalendarView(ctx.actor.userId);
  const isMonth = params.vue === "mois" || (params.vue !== "liste" && preference === "month");
  const month = validMonth(params.mois) ?? today.slice(0, 7);
  const notebook = ctx.spaces.find((s) => s.kind === "personal");
  // Sans carnet, l'athlète d'un club l'ouvre d'ici et arrive sur le planificateur.
  const openable = !notebook && !ctx.personal && (await canOpenNotebook(ctx.actor.userId));
  const switcher = (
    <nav aria-label={m.calendar.viewAndGroup} className="flex flex-wrap gap-2 py-1">
      {notebook && (
        <Button asChild variant="secondary">
          <Link href="/seances/nouvelle">{w.personal.planSession}</Link>
        </Button>
      )}
      {(notebook?.aiPlannerEnabled || openable) && (
        <Button asChild>
          <Link prefetch={false} href={notebook ? "/planificateur" : NOTEBOOK_FOR_PLANNER}>
            {m.aiPlanner.personalCreate}
          </Link>
        </Button>
      )}
      <CalendarViewPill view="list" href="/calendrier?vue=liste" active={!isMonth} label={m.calendar.list} />
      <CalendarViewPill
        view="month"
        href={`/calendrier?vue=mois&mois=${month}`}
        active={isMonth}
        label={m.calendar.month}
      />
    </nav>
  );
  if (isMonth) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <PageHeader title={m.nav.calendrier} />
        {switcher}
        <AthleteMonth ctx={ctx} month={month} today={today} />
      </div>
    );
  }
  const { sessions, competitions } = await athleteAgenda(ctx, {
    from: addDays(today, -28),
    to: addDays(today, 42),
  });
  const upcoming = sessions.filter((s) => s.date >= today);
  const past = sessions.filter((s) => s.date < today).reverse();
  const row = (s: (typeof sessions)[number]) => (
    <li key={s.id}>
      <Link
        href={s.status ? `/seance/${s.id}` : `/seances/${s.id}`}
        className="grid min-h-11 grid-cols-[26px_minmax(0,1fr)] items-center gap-x-3 px-4 py-2 text-inherit no-underline hover:bg-raise"
      >
        {s.status ? <StatusIcon status={s.status} /> : <span aria-hidden />}
        <span className="flex min-w-0 flex-col leading-snug">
          <span className="break-words font-semibold">{s.title}</span>
          <span className="t-caption font-normal text-soft">
            {s.source} · {capitalize(formatDateLong(s.date))},{" "}
            {s.variant ? m.variant[s.variant].toLowerCase() : w.personal.calendar.draft}
          </span>
        </span>
      </Link>
    </li>
  );
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title={m.nav.calendrier} />
      {switcher}
      <CalendarPhases ctx={ctx} from={today} to={addDays(today, 42)} today={today} open />
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
  const params = await searchParams;
  // L'athlète d'un groupe lit ses séances ; l'athlète autonome planifie les siennes, comme un coach.
  if (!ctx.planner) return <AthleteCalendar ctx={ctx} params={params} />;
  const today = todayIso();
  const selectedWeek = isoDate.safeParse(params.semaine).success ? params.semaine : undefined;
  const selectedMonth = validMonth(params.mois);
  const preference = await getCalendarView(ctx.actor.userId);
  // Une adresse explicite prime ; sinon le dernier choix de l'utilisateur, puis la semaine.
  const view =
    params.vue === "mois"
      ? "month"
      : params.vue === "liste"
        ? "list"
        : selectedWeek
          ? "week"
          : selectedMonth
            ? "month"
            : (preference ?? "week");
  const isMonth = view === "month";
  const isList = view === "list";
  const usesMonth = isMonth || isList;
  const month = selectedMonth ?? (selectedWeek ?? today).slice(0, 7);
  const week = startOfWeek(selectedWeek ?? (usesMonth && selectedMonth ? `${selectedMonth}-01` : today));
  const access = await requireOrgMember(ctx.actor.userId, ctx.organizationId, "viewTracking");
  const range = monthRange(month);
  const from = usesMonth ? range.from : week;
  const to = usesMonth ? range.to : addDays(week, 6);
  const [{ readOnly, ...data }, groups, athletes] = await Promise.all([
    listPlanning(ctx.actor.userId, ctx.organizationId, { from, to, groupId: params.groupe, summary: usesMonth }),
    listGroups(access),
    listAthletes(ctx.actor.userId, ctx.organizationId),
  ]);
  const href = (next: Search) => {
    const q = new URLSearchParams();
    const merged = {
      vue: isMonth ? "mois" : isList ? "liste" : undefined,
      semaine: usesMonth ? undefined : week,
      mois: usesMonth ? month : undefined,
      groupe: params.groupe,
      ...next,
    };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/calendrier?${q.toString()}`;
  };
  const label = usesMonth ? monthLabel(month) : m.coach.weekOf(formatDayMonth(week));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={m.nav.calendrier}
        actions={
          <>
            <BatchPublication
              key={`${ctx.organizationId}:${from}:${to}:${params.groupe ?? "all"}`}
              sessions={data.sessions.filter((s) => (usesMonth ? s.date.startsWith(month) : true))}
            />
            <CompetitionDialog athletes={athletes} today={today} />
            {!usesMonth && !ctx.personal ? <DuplicateWeekDialog week={week} groups={groups} /> : null}
            {ctx.space.aiPlannerEnabled || ctx.space.aiPlannerUpgrade ? (
              // Sur téléphone, juste après « Nouvelle séance » : les deux façons de créer se voient sans défiler.
              <Button asChild variant="secondary" size="sm" className="max-desktop:-order-1">
                <Link
                  href={`/planificateur?date=${usesMonth ? today : week}${params.groupe ? `&groupe=${encodeURIComponent(params.groupe)}` : ""}`}
                  prefetch={false}
                >
                  {ctx.personal ? m.aiPlanner.personalCreate : m.aiPlanner.title}
                </Link>
              </Button>
            ) : null}
            <Button asChild size="sm" className="order-first desktop:order-none">
              <Link
                href={newSessionHref({
                  date: usesMonth ? `${month}-01` : defaultDateForWeek(week, todayIso()),
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
          previous={usesMonth ? href({ mois: shiftMonthKey(month, -1) }) : href({ semaine: addDays(week, -7) })}
          next={usesMonth ? href({ mois: shiftMonthKey(month, 1) }) : href({ semaine: addDays(week, 7) })}
          previousLabel={w.planning.previousPeriod}
          nextLabel={w.planning.nextPeriod}
        />
        <nav
          aria-label={m.calendar.viewAndGroup}
          className="flex max-w-full gap-2 overflow-x-auto py-1 desktop:flex-wrap desktop:overflow-visible"
        >
          <CalendarViewPill
            view="week"
            href={href({ vue: undefined, mois: undefined, semaine: week })}
            active={view === "week"}
            label={m.calendar.week}
            desktopOnly
          />
          <CalendarViewPill
            view="month"
            href={href({ vue: "mois", semaine: undefined, mois: month })}
            active={isMonth}
            label={m.calendar.month}
          />
          <CalendarViewPill
            view="list"
            href={href({ vue: "liste", semaine: undefined, mois: month })}
            active={isList}
            label={m.calendar.list}
          />
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
      <CalendarDetailPanel
        sessionId={uuid.safeParse(params.seance).success ? params.seance : undefined}
        returnTo={href({})}
        personal={ctx.personal}
      >
        {ctx.personal ? (
          <PersonalSessionPanel session={data.sessions.find((s) => s.id === params.seance)} />
        ) : uuid.safeParse(params.seance).success ? (
          <SessionFollowupContent
            params={Promise.resolve({ id: params.seance! })}
            searchParams={Promise.resolve({ retour: href({}) })}
            compact
          />
        ) : null}
      </CalendarDetailPanel>
      {isMonth ? (
        <MonthBoard
          month={month}
          today={today}
          data={data}
          readOnly={readOnly}
          returnTo={href({})}
          groupId={params.groupe}
        />
      ) : isList ? (
        <ListBoard month={month} today={today} data={data} returnTo={href({})} />
      ) : (
        <WeekBoard
          week={week}
          today={today}
          data={data}
          readOnly={readOnly}
          returnTo={href({})}
          groupId={params.groupe}
        />
      )}
    </div>
  );
}
