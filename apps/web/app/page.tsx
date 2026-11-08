import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { formatPrice, PLANS, TRIAL_DAYS } from "@tartan/domain";
import { m } from "@tartan/i18n";
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
import { JumpFilm } from "@/features/landing/jump-film";
import { LapBend } from "@/features/landing/lap";
import { SiteFooter, SiteHeader } from "@/features/shell/site-chrome";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: { absolute: m.brand.storeName },
  description: m.landing.description,
  alternates: { canonical: "https://tartan.coach" },
};

const t = m.landing;
const bendPadding = "pt-[72px] pb-[88px] desktop:pt-[120px] desktop:pb-[144px]";
const sectionTitle =
  "text-balance font-display text-[44px] font-bold leading-[46px] desktop:text-[64px] desktop:leading-[64px]";
const body = "max-w-[56ch] text-[17px] leading-[25px]";

const Phone = ({
  src,
  alt,
  sizes,
  priority,
}: {
  src: StaticImageData;
  alt: string;
  sizes: string;
  priority?: boolean;
}) => (
  <Image
    src={src}
    alt={alt}
    sizes={sizes}
    priority={priority}
    className="h-auto w-full rounded-card border border-lane/40"
  />
);

const strength = [iosStrength, iosPlyo, iosRunning, iosCones];

export default function LandingPage() {
  const signupOpen = env().COACH_SIGNUP_MODE === "public";
  const cta = (
    // Une vraie navigation : la création d'espace vit sur app.tartan.coach, hors de portée du préchargement.
    <a
      href={signupOpen ? "/connexion?creer=1" : "/contact"}
      className="inline-flex min-h-[52px] items-center rounded-full bg-accent px-7 text-base font-semibold text-on-accent no-underline"
    >
      {signupOpen ? t.ctaOpen : t.ctaClosed}
    </a>
  );

  return (
    <main className="min-h-dvh overflow-x-clip">
      <div className="mx-auto max-w-[1200px] px-4 pt-4 desktop:px-6 desktop:pt-6">
        <SiteHeader />
        <section className="grid gap-10 pb-12 pt-10 desktop:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] desktop:items-center desktop:gap-14 desktop:pb-16 desktop:pt-14">
          <div>
            <h1 className="text-balance font-display text-[56px] font-bold leading-[0.95] desktop:text-[84px]">
              {t.title}
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-7">{t.lead}</p>
            <p className="mt-4 font-semibold">{t.types}</p>
            <div className="mt-8">
              {cta}
              <p className="mt-3 max-w-[38ch] text-sm">
                {t.offer(PLANS.discovery.limits.maxAthletes ?? 0, TRIAL_DAYS)}
              </p>
            </div>
          </div>
          <figure className="mx-auto w-full max-w-[340px]">
            <Phone src={iosHome} alt={t.heroAltPhone} sizes="(min-width: 1024px) 340px, 80vw" priority />
            <figcaption className="mt-3 text-sm">{t.captureNote}</figcaption>
          </figure>
        </section>
      </div>

      <JumpFilm cta={cta} />

      <section className="mx-auto max-w-[1200px] px-4 py-12 desktop:px-6 desktop:py-20">
        <div className="grid gap-4 desktop:grid-cols-2 desktop:items-end desktop:gap-14">
          <h2 className={sectionTitle}>{t.coach.title}</h2>
          <p className={body}>{t.coach.body}</p>
        </div>
        <Image
          src={webMonth}
          alt={t.heroAltDesktop}
          sizes="(min-width: 1200px) 1152px, 100vw"
          className="mt-8 h-auto w-full rounded-card"
        />
      </section>

      <LapBend side="right" start="bleed">
        <div className={`mx-auto max-w-[1200px] pl-4 pr-12 desktop:pl-6 desktop:pr-24 ${bendPadding}`}>
          <div className="grid gap-8 desktop:grid-cols-2 desktop:items-center desktop:gap-14">
            <div>
              <h2 className={sectionTitle}>{t.coach.builderTitle}</h2>
              <p className={`mt-4 ${body}`}>{t.coach.builderBody}</p>
            </div>
            <Image
              src={webBuilder}
              alt={t.coach.builderAlt}
              sizes="(min-width: 1024px) 520px, 100vw"
              className="h-auto w-full rounded-card"
            />
          </div>
          <div className="mt-12 grid gap-8 desktop:mt-20 desktop:grid-cols-2 desktop:items-center desktop:gap-14">
            <Image
              src={webTracking}
              alt={t.coach.trackingAlt}
              sizes="(min-width: 1024px) 520px, 100vw"
              className="h-auto w-full rounded-card max-desktop:order-2"
            />
            <div>
              <h2 className={sectionTitle}>{t.coach.trackingTitle}</h2>
              <p className={`mt-4 ${body}`}>{t.coach.trackingBody}</p>
            </div>
          </div>
        </div>
      </LapBend>

      <section className="mx-auto max-w-[1200px] py-12 desktop:px-6 desktop:py-20">
        <div className="px-4 desktop:px-0">
          <h2 className={sectionTitle}>{t.content.title}</h2>
          <p className={`mt-4 ${body}`}>{t.content.body}</p>
        </div>
        <ul
          tabIndex={0}
          aria-label={t.content.title}
          className="mt-8 flex snap-x gap-4 overflow-x-auto px-4 pb-2 desktop:grid desktop:grid-cols-4 desktop:overflow-visible desktop:px-0"
        >
          {t.content.items.map((item, index) => (
            <li
              key={item.label}
              className="w-[64vw] max-w-[280px] shrink-0 snap-start desktop:w-auto desktop:max-w-none"
            >
              <Phone src={strength[index]!} alt={item.alt} sizes="(min-width: 1024px) 270px, 64vw" />
              <p className="mt-3 font-semibold">{item.label}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="on-hero py-12 desktop:py-20">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-4 desktop:grid-cols-2 desktop:px-6">
          <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-5">
            <Phone src={iosMonth} alt={t.views.alt} sizes="(min-width: 1024px) 240px, 40vw" />
            <div>
              <h2 className="text-balance font-display text-[36px] font-bold leading-[38px] desktop:text-[48px] desktop:leading-[50px]">
                {t.views.title}
              </h2>
              <p className="mt-3 text-[17px] leading-[25px]">{t.views.body}</p>
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-5">
            <Phone src={iosProgress} alt={t.progress.alt} sizes="(min-width: 1024px) 240px, 40vw" />
            <div>
              <h2 className="text-balance font-display text-[36px] font-bold leading-[38px] desktop:text-[48px] desktop:leading-[50px]">
                {t.progress.title}
              </h2>
              <p className="mt-3 text-[17px] leading-[25px]">{t.progress.body}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1200px] gap-8 px-4 py-12 desktop:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] desktop:items-center desktop:gap-14 desktop:px-6 desktop:py-20">
        <div>
          <h2 className={sectionTitle}>{t.video.title}</h2>
          <p className={`mt-4 ${body}`}>{t.video.body}</p>
        </div>
        <figure className="mx-auto w-full max-w-[320px]">
          <Phone src={iosVideo} alt={t.video.alt} sizes="(min-width: 1024px) 320px, 80vw" />
          <figcaption className="mt-3 text-sm">{t.video.caption}</figcaption>
        </figure>
      </section>

      <LapBend side="right" end="bleed">
        <div className={`mx-auto max-w-[1200px] pl-4 pr-12 desktop:pl-6 desktop:pr-24 ${bendPadding}`}>
          <h2 className="max-w-[14ch] text-balance font-display text-[44px] font-bold leading-[46px] desktop:text-[72px] desktop:leading-[72px]">
            <Marked text={t.field.title} />
          </h2>
          <dl className="mt-8 desktop:mt-12">
            {t.field.items.map((item) => (
              <div
                key={item.title}
                className="grid gap-1 border-t-[3px] border-lane py-5 desktop:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] desktop:gap-8 desktop:py-6"
              >
                <dt className="font-display text-[32px] font-bold leading-9 desktop:text-[44px] desktop:leading-[48px]">
                  {item.title}
                </dt>
                <dd className="max-w-[56ch] text-[17px] leading-[25px] desktop:self-center">{item.body}</dd>
              </div>
            ))}
          </dl>
        </div>
        {/* La ligne d'arrivée coupe la piste, une seule fois (DESIGN.md). */}
        <span
          aria-hidden
          className="absolute bottom-[-3px] left-[11%] h-[calc(var(--lap-gap)*3+24px)] w-[7px] bg-lane"
        />
      </LapBend>

      <section className="mx-auto max-w-[1200px] px-4 pb-14 pt-16 desktop:px-6 desktop:pb-20 desktop:pt-24">
        <h2 className="text-balance font-display text-[60px] font-bold leading-[0.95] desktop:text-[116px]">
          <Marked text={t.finish.title} />
        </h2>
        <p className="mt-5 max-w-[52ch] text-[18px] leading-[26px]">
          {t.finish.prices(formatPrice(PLANS.coach.prices?.month ?? 0), formatPrice(PLANS.club.prices?.month ?? 0))}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          {cta}
          <Link href="/tarifs" className="inline-flex min-h-11 items-center font-semibold">
            {t.finish.pricing}
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-4 desktop:px-6">
        <SiteFooter />
      </div>
    </main>
  );
}
