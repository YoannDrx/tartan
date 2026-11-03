import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { addDays, startOfWeek } from "@tartan/domain";
import { formatDayMonth, m } from "@tartan/i18n";
import { FilterPill } from "@/components/filter-pill";
import { EmptyState, PageHeader, PeriodStepper } from "@/components/states";
import { Button } from "@/components/ui/button";
import { todayIso } from "@/lib/dates";
import { requireOrgMember } from "@/server/access";
import { requireStaffSpace } from "@/features/shell/space";
import { AlertList } from "@/features/tracking/alert-list";
import { TrackingTable } from "@/features/tracking/tracking-grid";
import { listGroups } from "@/server/org.service";
import { getAlerts, getTrackingGrid } from "@/server/tracking.service";
import { listAthletes } from "@/server/athlete.service";

export const metadata: Metadata = { title: m.coach.trackingTitle };

export default async function SuiviPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string; groupe?: string }>;
}) {
  const { actor, organizationId } = await requireStaffSpace();
  const { semaine, groupe } = await searchParams;
  const week = startOfWeek(semaine && /^\d{4}-\d{2}-\d{2}$/.test(semaine) ? semaine : todayIso());
  const access = await requireOrgMember(actor.userId, organizationId, "viewTracking");
  const [grid, alerts, groups, athletes] = await Promise.all([
    getTrackingGrid(actor.userId, organizationId, { week, groupId: groupe }),
    getAlerts(actor.userId, organizationId),
    listGroups(access),
    listAthletes(actor.userId, organizationId),
  ]);
  const query = (params: { semaine?: string; groupe?: string }) => {
    const next = new URLSearchParams();
    if (params.semaine) next.set("semaine", params.semaine);
    if (params.groupe) next.set("groupe", params.groupe);
    const text = next.toString();
    return text ? `/suivi?${text}` : "/suivi";
  };
  // Un espace neuf a déjà une bibliothèque : seul le premier athlète dit que le coach a démarré.
  const firstRun = athletes.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={m.coach.trackingTitle}
        actions={
          <>
            <Button asChild size="sm" variant="secondary">
              <a href={`/api/v1/orgs/${organizationId}/tracking/export?from=${week}&to=${addDays(week, 6)}`} download>
                {m.coach.exportCsv}
              </a>
            </Button>
            <Button asChild size="sm" className="order-first desktop:order-none">
              <Link href="/seances/nouvelle">
                <Plus aria-hidden className="size-5" />
                {m.coach.newSession}
              </Link>
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <PeriodStepper
          label={m.coach.weekOf(formatDayMonth(week))}
          previous={query({ semaine: addDays(week, -7), groupe })}
          next={query({ semaine: addDays(week, 7), groupe })}
          previousLabel="Semaine précédente"
          nextLabel="Semaine suivante"
        />
        {groups.length > 1 ? (
          <nav aria-label="Filtrer par groupe" className="flex max-w-full gap-2 overflow-x-auto py-1">
            <FilterPill href={query({ semaine })} active={!groupe}>
              {m.coach.allGroups}
            </FilterPill>
            {groups.map((g) => (
              <FilterPill key={g.id} href={query({ semaine, groupe: g.id })} active={groupe === g.id}>
                {g.name}
              </FilterPill>
            ))}
          </nav>
        ) : null}
      </div>

      {firstRun ? (
        <section aria-labelledby="demarrer" className="rounded-card on-card bg-card">
          <h2 id="demarrer" className="t-h2 px-4 pt-4">
            {m.home.guidedTitle}
          </h2>
          <ol className="divide-y divide-card-line">
            {[
              { href: "/reglages#invitations", title: m.home.inviteAthletes, detail: m.home.inviteAthletesDetail },
              { href: "/exercices?nouveau=1", title: m.home.createExercise, detail: m.home.createExerciseDetail },
              { href: "/seances/nouvelle", title: m.home.createSession, detail: m.home.createSessionDetail },
            ].map((step, i) => (
              <li key={step.href}>
                <Link
                  href={step.href}
                  className="flex min-h-11 items-center gap-4 px-4 py-3 text-inherit no-underline hover:bg-raise"
                >
                  <span aria-hidden className="t-num text-[28px]">
                    {i + 1}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-semibold">{step.title}</span>
                    <span className="t-caption font-normal text-soft">{step.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* La grille reste l'écran de travail : au bureau, les alertes passent à côté. */}
      <div
        className={
          alerts.length > 0 ? "grid items-start gap-4 desktop:grid-cols-[minmax(0,1fr)_340px]" : "flex flex-col gap-4"
        }
      >
        <div className="flex min-w-0 flex-col gap-4 max-desktop:order-2">
          {grid.rows.length === 0 && !firstRun ? (
            <EmptyState
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/reglages#invitations">{m.home.inviteAthletes}</Link>
                </Button>
              }
            >
              {m.coach.noAthletes}
            </EmptyState>
          ) : null}
          {grid.rows.length > 0 && grid.sessions.length === 0 ? (
            <EmptyState
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/calendrier">{m.nav.calendrier}</Link>
                </Button>
              }
            >
              {m.coach.noSessions}
            </EmptyState>
          ) : null}
          {grid.rows.length > 0 && grid.sessions.length > 0 ? (
            <>
              <TrackingTable grid={grid} />
            </>
          ) : null}
        </div>
        {alerts.length > 0 ? (
          <section aria-label={m.coach.alerts} className="min-w-0 max-desktop:order-1">
            <AlertList alerts={alerts.slice(0, 6)} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
