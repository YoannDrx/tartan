import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { formatPrice, PLANS, TRIAL_DAYS } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Marked } from "@/components/marked";
import { JumpScrubber } from "@/features/landing/jump-scrubber";
import calendarCapture from "@/features/landing/images/calendrier.png";
import analysisCapture from "@/features/landing/images/analyse-v1-1.png";
import { LapBend } from "@/features/landing/lap";
import { RollCallDemo } from "@/features/landing/roll-call-demo";
import { ValidationDemo } from "@/features/landing/validation-demo";
import { SiteFooter, SiteHeader } from "@/features/shell/site-chrome";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: { absolute: m.brand.storeName },
  description: m.landing.description,
  alternates: { canonical: "https://tartan.coach" },
};

const t = m.landing;
const bendPadding = "pt-[72px] pb-[88px] desktop:pt-[120px] desktop:pb-[144px]";

export default function LandingPage() {
  const signupOpen = env().COACH_SIGNUP_MODE === "public";
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
      <div className="mx-auto max-w-[1200px] px-4 pt-4 desktop:px-6 desktop:pt-6">
        <SiteHeader />
        <section className="pb-10 pt-12 desktop:pb-14 desktop:pt-16">
          <h1 className="max-w-[22ch] text-balance font-display text-[60px] font-bold leading-[0.95] desktop:text-[88px]">
            {t.title}
          </h1>
          <div className="mt-6 grid gap-6 desktop:grid-cols-2 desktop:items-end desktop:gap-14">
            <div>
              <p className="max-w-[52ch] text-lg leading-7">{t.lead}</p>
              <p className="mt-4 font-semibold">{t.disciplines}</p>
            </div>
            <div className="desktop:justify-self-end">
              {cta}
              <p className="mt-3 max-w-[38ch] text-sm">
                {t.offer(PLANS.discovery.limits.maxAthletes ?? 0, TRIAL_DAYS)}
              </p>
            </div>
          </div>
        </section>
        <nav aria-label={t.journeyLabel} className="flex flex-wrap gap-x-6 gap-y-1 border-y border-lane py-3">
          {t.journey.map((step, index) => (
            <a key={step.id} href={`#${step.id}`} className="inline-flex min-h-11 items-center gap-2 font-semibold">
              <span aria-hidden className="font-display text-2xl">
                {index + 1}.
              </span>{" "}
              {step.label}
            </a>
          ))}
        </nav>
        <section id="preparer" className="scroll-mt-6 py-12 desktop:py-16">
          <div className="grid gap-4 desktop:grid-cols-2 desktop:items-end desktop:gap-14">
            <h2 className="font-display text-[44px] font-bold leading-none desktop:text-[64px]">{t.prepare.title}</h2>
            <p className="max-w-[56ch] text-[17px] leading-[25px]">{t.prepare.body}</p>
          </div>
          <figure className="mt-8">
            <Image
              src={calendarCapture}
              alt={t.prepare.alt}
              className="h-auto w-full rounded-card"
              sizes="(min-width: 1200px) 1152px, 100vw"
            />
            <figcaption className="mt-3 flex flex-wrap justify-between gap-x-6 gap-y-2 text-sm">
              <span>{t.prepare.caption}</span>
              <a href={calendarCapture.src} className="inline-flex min-h-11 items-center font-semibold">
                {t.prepare.enlarge}
              </a>
            </figcaption>
          </figure>
        </section>
      </div>

      <LapBend side="right" start="bleed">
        <div
          id="individualiser"
          className={`mx-auto max-w-[1200px] scroll-mt-6 pl-4 pr-12 desktop:pl-6 desktop:pr-24 ${bendPadding}`}
        >
          <div className="grid gap-8 desktop:grid-cols-2 desktop:items-center desktop:gap-14">
            <div>
              <h2 className="text-balance font-display text-[44px] font-bold leading-[46px] desktop:text-[64px] desktop:leading-[64px]">
                {t.rollCall.title}
              </h2>
              <p className="mt-4 max-w-[46ch] text-[17px] leading-[25px]">{t.rollCall.body}</p>
            </div>
            <RollCallDemo />
          </div>
        </div>
      </LapBend>

      <section id="realiser" className="mx-auto max-w-[1200px] scroll-mt-6 px-4 py-12 desktop:px-6 desktop:py-16">
        <h2 className="font-display text-[44px] font-bold leading-none desktop:text-[64px]">{t.realize.title}</h2>
        <p className="mb-8 mt-4 max-w-[65ch] text-[17px] leading-[25px]">{t.realize.body}</p>
        <ValidationDemo />
      </section>

      <section id="progresser" className="on-hero scroll-mt-6 py-12 desktop:py-16">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 desktop:grid-cols-2 desktop:items-start desktop:gap-14 desktop:px-6">
          <div>
            <h2 className="font-display text-[44px] font-bold leading-none desktop:text-[64px]">{t.progress.title}</h2>
            <p className="mt-4 text-[17px] leading-[25px]">{t.progress.body}</p>
            <p className="mt-6 border-t border-line pt-4 font-semibold">{t.progress.availability}</p>
          </div>
          <figure>
            <a
              href={analysisCapture.src}
              aria-label={t.progress.enlarge}
              className="block rounded-card focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <Image
                src={analysisCapture}
                alt={t.progress.alt}
                className="max-h-[440px] w-full rounded-card object-cover object-top"
                sizes="(min-width: 1024px) 550px, 100vw"
              />
            </a>
            <figcaption className="mt-3 text-sm">
              {t.progress.caption}
              <a href={analysisCapture.src} className="mt-1 flex min-h-11 items-center font-semibold">
                {t.progress.enlarge}
              </a>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-12 desktop:px-6 desktop:py-16">
        <h2 className="font-display text-[44px] font-bold leading-none desktop:text-[64px]">{t.video.title}</h2>
        <p className="mt-4 max-w-[65ch] text-[17px] leading-[25px]">{t.video.body}</p>
        <details className="mt-6 border-y border-lane py-3">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">{t.videoExample}</summary>
          <div className="mx-auto max-w-[720px] py-6">
            <JumpScrubber />
          </div>
        </details>
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
                className="grid gap-1 border-t-[3px] border-lane py-5 desktop:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] desktop:gap-8 desktop:py-7"
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
