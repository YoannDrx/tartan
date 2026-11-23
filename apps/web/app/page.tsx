import type { Metadata } from "next";
import { PLANS, TRIAL_DAYS } from "@tartan/domain";
import { m } from "@tartan/i18n";
import Link from "next/link";
import { Marked } from "@/components/marked";
import { PricingGrid } from "@/features/billing/pricing";
import { landingQuestions } from "@/features/help/content";
import { HelpQuestions } from "@/features/help/questions";
import { FeatureShowcase, type ShowcaseItem } from "@/features/landing/feature-showcase";
import athleteCalculator from "@/features/landing/images/athlete-calculateur.png";
import athleteRunning from "@/features/landing/images/athlete-course.png";
import athleteExercise from "@/features/landing/images/athlete-fiche.png";
import athleteToday from "@/features/landing/images/athlete-journee.png";
import athleteStrength from "@/features/landing/images/athlete-musculation.png";
import athletePlyo from "@/features/landing/images/athlete-pliometrie.png";
import athleteProgress from "@/features/landing/images/athlete-progres.png";
import athleteWeek from "@/features/landing/images/athlete-semaine.png";
import athleteVideo from "@/features/landing/images/athlete-video.png";
import coachAnalysis from "@/features/landing/images/coach-analyse.png";
import coachAthlete from "@/features/landing/images/coach-athlete.png";
import coachLibrary from "@/features/landing/images/coach-bibliotheque.png";
import coachCalculator from "@/features/landing/images/coach-calculateur.png";
import coachBuilder from "@/features/landing/images/coach-constructeur.png";
import coachExercise from "@/features/landing/images/coach-fiche-exercice.png";
import coachMonth from "@/features/landing/images/coach-mois.png";
import coachPlanner from "@/features/landing/images/coach-planificateur.png";
import coachWeek from "@/features/landing/images/coach-semaine.png";
import coachTracking from "@/features/landing/images/coach-suivi.png";
import coachVideo from "@/features/landing/images/coach-video.png";
import { JumpFilm } from "@/features/landing/jump-film";
import { LapBend } from "@/features/landing/lap";
import { SiteFooter, SiteHeader } from "@/features/shell/site-chrome";
import { billingEnabled } from "@/lib/stripe";
import { platformSettings } from "@/server/platform-settings.service";

export const metadata: Metadata = {
  title: { absolute: m.brand.storeName },
  description: m.landing.description,
  alternates: { canonical: "https://tartan.coach" },
};

const t = m.landing;
const bendPadding = "pt-[72px] pb-[88px] desktop:pt-[120px] desktop:pb-[144px]";
// Les couloirs longent un bord : le contenu s'en écarte du côté du virage.
const rightBend = `mx-auto max-w-[1200px] pl-4 pr-12 desktop:pl-6 desktop:pr-24 ${bendPadding}`;
const leftBend = `mx-auto max-w-[1200px] pl-12 pr-4 desktop:pl-24 desktop:pr-6 ${bendPadding}`;
const sectionTitle =
  "text-balance font-display text-[44px] font-bold leading-[46px] desktop:text-[72px] desktop:leading-[72px]";
const smallTitle =
  "text-balance font-display text-[36px] font-bold leading-[38px] desktop:text-[52px] desktop:leading-[54px]";
const body = "max-w-[46ch] text-[17px] leading-[25px]";

// Chaque onglet, son texte et sa vraie capture (images/provenance.json), dans l'ordre du parcours : préparer,
// individualiser, réaliser, progresser.
const coachScreens: ShowcaseItem[] = (
  [
    ["semaine", coachWeek],
    ["mois", coachMonth],
    ["constructeur", coachBuilder],
    ["planificateur", coachPlanner],
    ["bibliotheque", coachLibrary],
    ["fiche", coachExercise],
    ["suivi", coachTracking],
    ["analyse", coachAnalysis],
    ["calculateur", coachCalculator],
    ["athlete", coachAthlete],
    ["video", coachVideo],
  ] as const
).map(([key, image]) => ({ key, image, ...t.coach.features[key] }));

const athleteScreens: ShowcaseItem[] = (
  [
    ["journee", athleteToday],
    ["semaine", athleteWeek],
    ["musculation", athleteStrength],
    ["pliometrie", athletePlyo],
    ["course", athleteRunning],
    ["fiche", athleteExercise],
    ["calculateur", athleteCalculator],
    ["progres", athleteProgress],
    ["video", athleteVideo],
  ] as const
).map(([key, image]) => ({ key, image, ...t.athlete.features[key] }));

// Réglable depuis la console : la page se recalcule au plus tard chaque minute.
export const revalidate = 60;

export default async function LandingPage() {
  const settings = await platformSettings();
  const signupOpen = settings.signupMode === "public";
  const cta = (
    // Une vraie navigation : la création d'espace vit sur app.tartan.coach, hors de portée du préchargement.
    <a
      href={signupOpen ? "/connexion?creer=1" : "/contact"}
      className="inline-flex min-h-[52px] items-center rounded-full bg-accent px-7 text-base font-semibold text-on-accent no-underline hover:bg-accent-hover"
    >
      {signupOpen ? t.ctaOpen : m.billing.contactUs}
    </a>
  );

  return (
    <main className="min-h-dvh overflow-x-clip">
      <JumpFilm
        header={<SiteHeader />}
        cta={cta}
        offer={t.offer(PLANS.discovery.limits.maxAthletes ?? 0, TRIAL_DAYS)}
      />

      {/* Les virages se touchent : une seule piste, du film à la ligne d'arrivée. */}
      <LapBend side="right" start="bleed">
        <section aria-labelledby="coach" className={rightBend}>
          <h2 id="coach" className={sectionTitle}>
            <Marked text={t.coach.title} />
          </h2>
          <p className={`mt-4 ${body}`}>{t.coach.body}</p>
          <FeatureShowcase label={t.coach.tabs} items={coachScreens} device="laptop" />
        </section>
      </LapBend>

      <LapBend side="left">
        <section aria-labelledby="athlete" className={leftBend}>
          <h2 id="athlete" className={sectionTitle}>
            <Marked text={t.athlete.title} />
          </h2>
          <p className={`mt-4 ${body}`}>{t.athlete.body}</p>
          <FeatureShowcase label={t.athlete.tabs} items={athleteScreens} device="phone" />
        </section>
      </LapBend>

      <LapBend side="right" end="bleed">
        <div className={rightBend}>
          <h2 className={`${sectionTitle} max-w-[14ch]`}>
            <Marked text={t.field.title} />
          </h2>
          <dl className="mt-8 desktop:mt-12">
            {t.field.items.map((item) => (
              <div
                key={item.title}
                className="grid gap-1 border-t-[3px] border-lane py-5 desktop:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] desktop:gap-8 desktop:py-7"
              >
                <dt className="font-display text-[32px] font-bold leading-9 desktop:text-[44px] desktop:leading-[48px]">
                  {item.title}
                </dt>
                <dd className="max-w-[56ch] text-[17px] leading-[25px] desktop:self-center">{item.body}</dd>
              </div>
            ))}
          </dl>

          <section id="tarifs" className="mt-16 scroll-mt-6 desktop:mt-28">
            <h2 className={sectionTitle}>
              <Marked text={t.pricing.title} />
            </h2>
            <p className={`mb-8 mt-4 ${body}`}>{t.pricing.body}</p>
            <PricingGrid
              billingEnabled={billingEnabled() && settings.checkoutEnabled}
              signupOpen={signupOpen}
              initialInterval="month"
            />
          </section>
        </div>
        {/* La ligne d'arrivée coupe la piste, une seule fois (DESIGN.md). */}
        <span
          aria-hidden
          className="absolute bottom-[-3px] left-[11%] h-[calc(var(--lap-gap)*3+24px)] w-[7px] bg-lane"
        />
      </LapBend>

      <section
        aria-labelledby="questions"
        className="mx-auto max-w-[1200px] px-4 pt-16 desktop:grid desktop:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] desktop:gap-14 desktop:px-6 desktop:pt-24"
      >
        <div>
          <h2 id="questions" className={smallTitle}>
            <Marked text={t.faq.title} />
          </h2>
          <Link
            href="/aide"
            className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
          >
            {t.faq.more}
          </Link>
        </div>
        <HelpQuestions questions={landingQuestions()} className="mt-4 desktop:mt-0" />
      </section>

      <section className="mx-auto max-w-[1200px] px-4 pb-14 pt-16 desktop:px-6 desktop:pb-20 desktop:pt-24">
        <h2 className="text-balance font-display text-[60px] font-bold leading-[0.95] desktop:text-[116px]">
          <Marked text={t.finish.title} />
        </h2>
        <div className="mt-8">{cta}</div>
      </section>

      <div className="mx-auto max-w-[1200px] px-4 desktop:px-6">
        <SiteFooter />
      </div>
    </main>
  );
}
