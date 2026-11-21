import { w } from "@tartan/i18n/web";
import type { Metadata } from "next";
import Link from "next/link";
import { LaneNumber } from "@/components/lane-number";
import { PageHeader, TrackTile } from "@/components/states";
import { Button } from "@/components/ui/button";
import { DemoSpaceSection } from "@/features/demo-space/demo-space-section";
import { CoachGuide } from "@/features/onboarding/coach-guide";
import { InvitePanel } from "@/features/onboarding/invite-panel";
import { ReopenTour } from "@/features/onboarding/reopen-tour";
import { FEATURES, type FeatureKey } from "@/features/onboarding/tour-features";
import { requireStaffSpace } from "@/features/shell/space";
import { DEMO_SPACE_ENABLED } from "@/lib/onboarding-paths";
import { RUBRIC_ATHLETE } from "@/lib/rubric-athlete";
import { getDemoSpace } from "@/server/demo-space.service";
import { getFeatureOverview, getGuideContext, getOnboarding } from "@/server/onboarding.service";

const t = w.onboarding;

export const metadata: Metadata = { title: t.page.title };

// Les premiers pas, toujours accessibles (menu de l'engrenage, aide) : les étapes de l'espace, puis chaque grande
// fonction avec son état ici. C'est la référence après le tour de piste.
export default async function PremiersPasPage() {
  const { actor, organizationId, space } = await requireStaffSpace();
  const demo = DEMO_SPACE_ENABLED ? await getDemoSpace(actor.userId, organizationId) : null;
  // Depuis la démonstration, les premiers pas sont ceux de l'espace réel : seule la démonstration se gère ici.
  if (space.isDemo) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader title={t.page.title} detail={t.page.lead} />
        <DemoSpaceSection demo={demo} />
      </div>
    );
  }
  const [onboarding, guide, overview] = await Promise.all([
    getOnboarding(actor.userId, organizationId),
    getGuideContext(actor.userId, organizationId),
    getFeatureOverview(actor.userId, organizationId),
  ]);
  const plannerAvailable = Boolean(space.aiPlannerEnabled);
  const installed = onboarding.optionalSteps.find((step) => step.key === "install")?.done ?? false;
  const state: Record<FeatureKey, string> = {
    suivi: t.page.state.athletes(overview.athletes),
    calendrier: t.page.state.sessions(overview.publishedSessions),
    exercices: t.page.state.exercises(overview.exercises),
    videos: t.page.state.videos(overview.videos),
    planificateur: t.page.state.planner(plannerAvailable),
    progression: t.page.state.phases(overview.phases),
    annonces: t.page.state.announcements(overview.announcements),
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title={t.page.title} detail={t.page.lead} actions={<ReopenTour />} />

      <section aria-labelledby="etapes" className="flex flex-col gap-3">
        <h2 id="etapes" className="t-section">
          {t.page.stepsTitle}
        </h2>
        {onboarding.progress.done === onboarding.progress.total ? <p>{t.page.stepsDone}</p> : null}
        <CoachGuide place="page" data={{ ...onboarding, ...guide, plannerAvailable }} />
      </section>

      <section aria-labelledby="fonctions" className="flex flex-col gap-3">
        <h2 id="fonctions" className="t-section">
          {t.page.featuresTitle}
        </h2>
        <ol className="on-card divide-y divide-card-line rounded-card bg-card">
          {FEATURES.map((feature, index) => {
            const copy = t.tour.features[feature.key];
            const open = feature.gated !== "planner" || plannerAvailable;
            return (
              <li key={feature.key} className="flex items-start gap-3 p-4 tablet:gap-4">
                <LaneNumber n={index + 1} className="w-7 text-[32px]" />
                <div className="flex min-w-0 flex-1 flex-col gap-1 tablet:flex-row tablet:items-start tablet:gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h3 className="font-semibold">{copy.title}</h3>
                    <p className="max-w-prose">{copy.body}</p>
                    <p className="t-caption font-normal text-soft">{state[feature.key]}</p>
                  </div>
                  {open ? (
                    <Button asChild size="sm" variant="secondary" className="mt-1 self-start tablet:mt-0">
                      <Link href={feature.path} aria-label={t.guide.goTo(copy.title)}>
                        {t.guide.go}
                      </Link>
                    </Button>
                  ) : null}
                </div>
                <TrackTile athlete={RUBRIC_ATHLETE[feature.rubric]} pose="run" className="size-12 shrink-0" />
              </li>
            );
          })}
        </ol>
      </section>

      {guide.group ? (
        <section id="inviter" aria-labelledby="inviter-titre" className="flex scroll-mt-24 flex-col gap-3">
          <h2 id="inviter-titre" className="t-section">
            {t.page.inviteTitle}
          </h2>
          <div className="on-card rounded-card bg-card p-4">
            <InvitePanel groupId={guide.group.id} groupName={guide.group.name} />
          </div>
        </section>
      ) : null}

      <section id="installer" aria-labelledby="installer-titre" className="flex scroll-mt-24 flex-col gap-3">
        <h2 id="installer-titre" className="t-section">
          {t.page.installTitle}
        </h2>
        <p className="on-card max-w-prose rounded-card bg-card p-4">
          {installed ? t.page.installDone : t.page.installBody}
        </p>
      </section>

      {/* Voir Tartan rempli avant d'inviter son groupe, dans un espace à part et jetable. */}
      {DEMO_SPACE_ENABLED ? <DemoSpaceSection demo={demo} /> : null}
    </div>
  );
}
