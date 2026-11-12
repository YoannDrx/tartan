import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import { PLANS, TRIAL_DAYS } from "@tartan/domain";
import { m } from "@tartan/i18n";
import Link from "next/link";
import { Marked } from "@/components/marked";
import iosHome from "@/features/landing/images/ios-accueil.png";
import iosMonth from "@/features/landing/images/ios-mois.png";
import iosPlyo from "@/features/landing/images/ios-plio.png";
import iosCones from "@/features/landing/images/ios-plots.png";
import iosProgress from "@/features/landing/images/ios-progres.png";
import iosVideo from "@/features/landing/images/ios-video.png";
import iosStrength from "@/features/landing/images/ios-muscu.png";
import iosRunning from "@/features/landing/images/ios-technique.png";
import webBuilder from "@/features/landing/images/web-constructeur.png";
import webMonth from "@/features/landing/images/web-mois.png";
import webTracking from "@/features/landing/images/web-suivi.png";
import { landingQuestions } from "@/features/help/content";
import { HelpQuestions } from "@/features/help/questions";
import { GroupBand } from "@/features/landing/group-band";
import { WarmUp } from "@/features/landing/warm-up";
import { JumpFilm } from "@/features/landing/jump-film";
import { LapBend } from "@/features/landing/lap";
import { SiteFooter, SiteHeader } from "@/features/shell/site-chrome";
import { PricingGrid } from "@/features/billing/pricing";
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

// Une vraie capture dans sa carte encre : la seule surface sombre posée sur la piste.
const Capture = ({
  src,
  alt,
  sizes,
  className,
  priority,
}: {
  src: StaticImageData;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) => (
  <div className={`capture-glide on-card rounded-block bg-card p-2 desktop:p-3 ${className ?? ""}`}>
    <Image src={src} alt={alt} sizes={sizes} priority={priority} className="h-auto w-full rounded-card" />
  </div>
);

const strength = [iosStrength, iosPlyo, iosRunning, iosCones];

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
      {signupOpen ? t.ctaOpen : t.ctaClosed}
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
        <div className={rightBend}>
          <h2 className={sectionTitle}>
            <Marked text={t.coach.title} />
          </h2>
          <p className={`mt-4 ${body}`}>{t.coach.body}</p>
          <div className="relative mt-8 desktop:mt-12 desktop:pr-[150px]">
            <Capture src={webMonth} alt={t.heroAltDesktop} sizes="(min-width: 1200px) 900px, 100vw" />
            <figure className="mx-auto mt-4 w-[62%] max-w-[260px] desktop:absolute desktop:-bottom-12 desktop:right-0 desktop:mt-0 desktop:w-[240px]">
              <Capture src={iosHome} alt={t.heroAltPhone} sizes="(min-width: 1024px) 240px, 62vw" />
            </figure>
          </div>
          <p className="mt-4 text-sm desktop:mt-16">{t.captureNote}</p>
        </div>
      </LapBend>

      <LapBend side="left">
        <div className={leftBend}>
          <div className="grid gap-8 desktop:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] desktop:items-center desktop:gap-14">
            <Capture src={webBuilder} alt={t.coach.builderAlt} sizes="(min-width: 1024px) 620px, 100vw" />
            <div>
              <h2 className={smallTitle}>
                <Marked text={t.coach.builderTitle} />
              </h2>
              <p className={`mt-4 ${body}`}>{t.coach.builderBody}</p>
            </div>
          </div>
          <div className="mt-14 grid gap-8 desktop:mt-24 desktop:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] desktop:items-center desktop:gap-14">
            {/* Sur téléphone, la capture d'abord, puis ce qu'elle montre. */}
            <div className="max-desktop:order-2">
              <h2 className={smallTitle}>
                <Marked text={t.coach.trackingTitle} />
              </h2>
              <p className={`mt-4 ${body}`}>{t.coach.trackingBody}</p>
            </div>
            <Capture src={webTracking} alt={t.coach.trackingAlt} sizes="(min-width: 1024px) 620px, 100vw" />
          </div>
        </div>
      </LapBend>

      <LapBend side="right">
        <div className={rightBend}>
          <h2 className={sectionTitle}>
            <Marked text={t.content.title} />
          </h2>
          <p className={`mt-4 ${body}`}>{t.content.body}</p>
          <ul className="mt-8 grid grid-cols-2 gap-3 desktop:mt-12 desktop:grid-cols-4 desktop:gap-5">
            {t.content.items.map((item, index) => (
              <li key={item.label}>
                <Capture src={strength[index]!} alt={item.alt} sizes="(min-width: 1024px) 260px, 42vw" />
                <p className="mt-3 font-display text-[22px] font-semibold leading-[26px] desktop:text-[28px] desktop:leading-8">
                  {item.label}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </LapBend>

      <LapBend side="left">
        <div className={leftBend}>
          <div className="grid gap-14 desktop:grid-cols-2 desktop:gap-14">
            {[
              { src: iosMonth, ...t.views },
              { src: iosProgress, ...t.progress },
            ].map((block) => (
              <div
                key={block.title}
                className="grid gap-5 tablet:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] tablet:items-center"
              >
                <Capture
                  src={block.src}
                  alt={block.alt}
                  sizes="(min-width: 1024px) 240px, (min-width: 768px) 38vw, 70vw"
                  className="mx-auto w-[70%] max-w-[280px] tablet:w-full"
                />
                <div>
                  <h2 className={smallTitle}>
                    <Marked text={block.title} />
                  </h2>
                  <p className="mt-3 text-[17px] leading-[25px]">{block.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </LapBend>

      <LapBend side="right" end="bleed">
        <div className={rightBend}>
          <div className="grid gap-8 desktop:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] desktop:items-center desktop:gap-14">
            <div>
              <h2 className={sectionTitle}>
                <Marked text={t.video.title} />
              </h2>
              <p className={`mt-4 ${body}`}>{t.video.body}</p>
            </div>
            <figure className="mx-auto w-full max-w-[320px]">
              <Capture src={iosVideo} alt={t.video.alt} sizes="(min-width: 1024px) 320px, 80vw" />
              <figcaption className="mt-3 text-sm">{t.video.caption}</figcaption>
            </figure>
          </div>

          <h2 className={`${sectionTitle} mt-16 max-w-[14ch] desktop:mt-28`}>
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

          <section aria-labelledby="groupe" className="mt-16 desktop:mt-28">
            <h2 id="groupe" className={sectionTitle}>
              <Marked text={t.group.title} />
            </h2>
            <p className={`mb-8 mt-4 ${body}`}>{t.group.body}</p>
            <GroupBand />
          </section>

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

      <WarmUp titleClassName={smallTitle} bodyClassName={body} />

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
