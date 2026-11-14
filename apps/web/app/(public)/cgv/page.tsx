import type { Metadata } from "next";
import { ATHLETE_VIDEOS_PER_MONTH, PLANS, TRIAL_DAYS, formatPrice } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { LegalPage } from "@/features/shell/legal-page";

const t = m.legal.cgvPage;

export const metadata: Metadata = { title: t.metaTitle };

const price = (plan: "coach" | "club") => {
  const prices = PLANS[plan].prices;
  return prices ? m.legal.cgvOffers.price(formatPrice(prices.month), formatPrice(prices.year)) : "";
};

// Les plafonds viennent des offres : la page ne peut pas diverger de ce qui est vendu.
const { discovery, coach, club } = PLANS;
const retention = (days: number | null) => m.billing.compare.retentionDays(days ?? 0);

export default function CgvPage() {
  return (
    <LegalPage title={t.title} updated={t.updated}>
      <h2>{t.sellerTitle}</h2>
      <p>{t.seller}</p>
      <h2>{t.offersTitle}</h2>
      <ul>
        <li>
          {m.legal.cgvOffers.discovery(
            discovery.limits.maxGroups ?? 0,
            discovery.limits.maxAthletes ?? 0,
            discovery.limits.maxVideosPerMonth ?? 0,
            discovery.limits.videoRetentionDays ?? 0,
            ATHLETE_VIDEOS_PER_MONTH.discovery ?? 0,
          )}
        </li>
        <li>
          {m.legal.cgvOffers.coach(
            price("coach"),
            coach.limits.maxAthletes ?? 0,
            coach.limits.maxCoaches ?? 0,
            coach.limits.maxVideosPerMonth ?? 0,
            retention(coach.limits.videoRetentionDays),
            ATHLETE_VIDEOS_PER_MONTH.coach ?? 0,
          )}
        </li>
        <li>
          {m.legal.cgvOffers.club(
            price("club"),
            club.limits.maxVideosPerMonth ?? 0,
            retention(club.limits.videoRetentionDays),
            ATHLETE_VIDEOS_PER_MONTH.club ?? 0,
          )}
        </li>
      </ul>
      <p>{t.pricesNote}</p>
      {t.sections(TRIAL_DAYS).map((section) => (
        <section key={section.title} className="flex flex-col gap-4">
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
    </LegalPage>
  );
}
