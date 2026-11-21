import { isoDate } from "@tartan/contracts";
import { newSessionHref } from "@/lib/session-navigation";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { addDays, defaultDateForWeek, startOfWeek } from "@tartan/domain";
import { formatDayMonth, m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { FilterPill } from "@/components/filter-pill";
import { EmptyState, PageHeader, PeriodStepper } from "@/components/states";
import { Button } from "@/components/ui/button";
import { todayIso } from "@/lib/dates";
import { requireOrgMember } from "@/server/access";
import { requireStaffSpace } from "@/features/shell/space";
import { AlertList } from "@/features/tracking/alert-list";
import { TrackingTable } from "@/features/tracking/tracking-table";
import { listGroups } from "@/server/org.service";
import { getAlerts, getTrackingGrid } from "@/server/tracking.service";
import { CoachGuide } from "@/features/onboarding/coach-guide";
import { Celebration } from "@/features/onboarding/celebration";
import { COACH_STEP_PATH } from "@/lib/onboarding-paths";
import { getGuideContext, getOnboarding } from "@/server/onboarding.service";

export const metadata: Metadata = { title: m.coach.trackingTitle };

export default async function SuiviPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string; groupe?: string }>;
}) {
  const { actor, organizationId, space } = await requireStaffSpace();
  const { semaine, groupe } = await searchParams;
  const week = startOfWeek(isoDate.safeParse(semaine).success ? semaine! : todayIso());
  const access = await requireOrgMember(actor.userId, organizationId, "viewTracking");
  const [grid, alerts, groups, onboarding, guide] = await Promise.all([
    getTrackingGrid(actor.userId, organizationId, { week, groupId: groupe }),
    getAlerts(actor.userId, organizationId),
    listGroups(access),
    getOnboarding(actor.userId, organizationId),
    getGuideContext(actor.userId, organizationId),
  ]);
  const query = (params: { semaine?: string; groupe?: string }) => {
    const next = new URLSearchParams();
    if (params.semaine) next.set("semaine", params.semaine);
    if (params.groupe) next.set("groupe", params.groupe);
    const text = next.toString();
    return text ? `/suivi?${text}` : "/suivi";
  };
  // La carte des premiers pas reste jusqu'à leur fin, sauf si le coach l'a refermée ; la fin se fête une fois.
  const firstRun = onboarding.guideVisible;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={m.coach.trackingTitle}
        actions={
          <>
            {space.progressionEnabled ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={`/analyse${groupe ? `?target=group:${groupe}` : ""}`}>{m.analysis.title}</Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="secondary">
              <a
                href={`/api/v1/orgs/${organizationId}/tracking/export?from=${week}&to=${addDays(week, 6)}${groupe ? `&groupId=${groupe}` : ""}`}
                download
              >
                {m.coach.exportCsv}
              </a>
            </Button>
            <Button asChild size="sm" className="order-first desktop:order-none">
              <Link
                href={newSessionHref({
                  date: defaultDateForWeek(week, todayIso()),
                  groupId: groupe,
                  returnTo: query({ semaine: week, groupe }),
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
          label={m.coach.weekOf(formatDayMonth(week))}
          previous={query({ semaine: addDays(week, -7), groupe })}
          next={query({ semaine: addDays(week, 7), groupe })}
          previousLabel="Semaine précédente"
          nextLabel="Semaine suivante"
        />
        {groups.length > 1 ? (
          <nav aria-label={w.tracking.groupFilter} className="flex max-w-full gap-2 overflow-x-auto py-1">
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

      {onboarding.celebrationDue ? <Celebration /> : null}
      {firstRun ? (
        <CoachGuide
          place="suivi"
          data={{ ...onboarding, ...guide, plannerAvailable: Boolean(space.aiPlannerEnabled) }}
        />
      ) : null}

      {/* La grille reste l'écran de travail : au bureau, les alertes passent à côté. */}
      <div
        className={
          alerts.length > 0 ? "grid items-start gap-4 desktop:grid-cols-[minmax(0,1fr)_340px]" : "flex flex-col gap-4"
        }
      >
        <div className="flex min-w-0 flex-col gap-4 max-desktop:order-2">
          {/* Un coach sans athlète ne voit pas une grille vide : ce qu'il a à faire, et où. */}
          {grid.rows.length === 0 ? (
            <EmptyState
              rubric="suivi"
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href={COACH_STEP_PATH.invite}>{w.onboarding.emptyGroupAction}</Link>
                </Button>
              }
            >
              {w.onboarding.emptyGroup}
            </EmptyState>
          ) : null}
          {grid.rows.length > 0 && grid.sessions.length === 0 ? (
            <EmptyState
              rubric="suivi"
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
            <TrackingTable grid={grid} today={todayIso()} returnTo={query({ semaine: week, groupe })} />
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
