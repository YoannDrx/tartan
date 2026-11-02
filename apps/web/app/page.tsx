import type { Metadata } from "next";
import Link from "next/link";
import { formatPrice, PLANS, TRIAL_DAYS } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { JumpScrubber } from "@/features/landing/jump-scrubber";
import { LapBend } from "@/features/landing/lap";
import { RollCallDemo } from "@/features/landing/roll-call-demo";
import { ValidationDemo } from "@/features/landing/validation-demo";
import { SiteFooter, SiteHeader } from "@/features/shell/site-chrome";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: { absolute: m.brand.storeName },
  description:
    "Le carnet d'entraînement partagé du coach d'athlé et de son groupe : séances, suivi et analyse vidéo. Gratuit jusqu'à 5 athlètes.",
  alternates: { canonical: "https://tartan.coach" },
};

const t = m.landing;
const bendPadding = "pt-[72px] pb-[88px] desktop:pt-[120px] desktop:pb-[144px]";

export default function LandingPage() {
  const signupOpen = env().COACH_SIGNUP_MODE === "public";
  const cta = (
    <Link
      href={signupOpen ? "/connexion?creer=1" : "/contact"}
      className="inline-flex min-h-[52px] items-center rounded-full bg-cta px-7 text-base font-semibold text-on-cta no-underline hover:bg-cta-hover"
    >
      {signupOpen ? t.ctaOpen : t.ctaClosed}
    </Link>
  );

  return (
    <main className="min-h-dvh overflow-x-clip">
      <div className="mx-auto max-w-[1200px] px-4 pt-6 desktop:px-6">
        <SiteHeader />
      </div>

      <section className="mx-auto max-w-[1200px] px-4 pb-14 pt-10 desktop:px-6 desktop:pb-20 desktop:pt-16">
        <h1 className="text-balance font-display text-[60px] font-bold leading-[0.95] desktop:text-[116px]">
          {t.title}
        </h1>
        <div className="mt-6 flex flex-col gap-6 desktop:mt-8 desktop:flex-row desktop:items-end desktop:justify-between">
          <p className="max-w-[52ch] text-[18px] leading-[26px] desktop:text-[20px] desktop:leading-[28px]">{t.lead}</p>
          <div className="shrink-0">
            {cta}
            <p className="t-caption mt-3 max-w-[32ch]">
              {t.offer(PLANS.discovery.limits.maxAthletes ?? 0, TRIAL_DAYS)}
            </p>
          </div>
        </div>
        <div className="mt-10 desktop:mt-14">
          <ValidationDemo />
        </div>
      </section>

      <LapBend side="right" start="bleed">
        <div className={`mx-auto max-w-[1200px] pl-4 pr-12 desktop:pl-6 desktop:pr-24 ${bendPadding}`}>
          <div className="grid gap-8 desktop:grid-cols-2 desktop:items-center desktop:gap-14">
            <div>
              <h2 className="text-balance font-display text-[44px] font-bold leading-[46px] desktop:text-[72px] desktop:leading-[72px]">
                {t.rollCall.title}
              </h2>
              <p className="mt-4 max-w-[46ch] text-[17px] leading-[25px]">{t.rollCall.body}</p>
            </div>
            <RollCallDemo />
          </div>
        </div>
      </LapBend>

      <LapBend side="left">
        <div className={`mx-auto max-w-[1200px] pl-12 pr-4 desktop:pl-24 desktop:pr-6 ${bendPadding}`}>
          <div className="grid gap-8 desktop:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] desktop:items-center desktop:gap-14">
            <div className="order-2 desktop:order-1">
              <JumpScrubber />
            </div>
            <div className="order-1 desktop:order-2">
              <h2 className="text-balance font-display text-[44px] font-bold leading-[46px] desktop:text-[72px] desktop:leading-[72px]">
                {t.video.title}
              </h2>
              <p className="mt-4 max-w-[40ch] text-[17px] leading-[25px]">{t.video.body}</p>
            </div>
          </div>
        </div>
      </LapBend>

      <LapBend side="right" end="bleed">
        <div className={`mx-auto max-w-[1200px] pl-4 pr-12 desktop:pl-6 desktop:pr-24 ${bendPadding}`}>
          <h2 className="max-w-[14ch] text-balance font-display text-[44px] font-bold leading-[46px] desktop:text-[72px] desktop:leading-[72px]">
            {t.field.title}
          </h2>
          <dl className="mt-8 desktop:mt-12">
            {t.field.items.map((item) => (
              <div
                key={item.title}
                className="grid gap-1 border-t-[3px] border-white py-5 desktop:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] desktop:gap-8 desktop:py-7"
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
          {t.finish.title}
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
