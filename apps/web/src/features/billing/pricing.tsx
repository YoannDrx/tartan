"use client";

import { formatPrice, plannerLimits, PLANS, TRIAL_DAYS, type BillingInterval, type PlanKey } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { checkoutAction, portalAction } from "./billing.action";

const SOLD: ("discovery" | "coach" | "club")[] = ["discovery", "coach", "club"];
const HIGHLIGHTED: PlanKey = "coach";

const count = (value: number | null) => (value === null ? m.billing.compare.unlimited : String(value));

// Une feuille réglée plutôt que trois cartes : chaque critère se compare d'un coup d'œil, sur une seule ligne.
const ROWS: { label: string; value: (plan: PlanKey) => string }[] = [
  { label: m.billing.compare.athletes, value: (plan) => count(PLANS[plan].limits.maxAthletes) },
  { label: m.billing.compare.groups, value: (plan) => count(PLANS[plan].limits.maxGroups) },
  { label: m.billing.compare.coaches, value: (plan) => count(PLANS[plan].limits.maxCoaches) },
  { label: m.billing.compare.videos, value: (plan) => count(PLANS[plan].limits.maxVideosPerMonth) },
  {
    label: m.billing.compare.retention,
    value: (plan) => {
      const days = PLANS[plan].limits.videoRetentionDays;
      return days === null ? m.billing.compare.retentionForever : m.billing.compare.retentionDays(days);
    },
  },
  {
    label: m.billing.compare.ai,
    value: (plan) => {
      const { proposals } = plannerLimits(plan);
      return proposals ? m.billing.compare.aiProposals(proposals) : m.billing.compare.aiNone;
    },
  },
  {
    label: m.billing.compare.trial,
    value: (plan) => (PLANS[plan].prices ? m.billing.compare.trialDays(TRIAL_DAYS) : m.billing.compare.none),
  },
];

const cellClass = (plan: PlanKey) =>
  cn(
    "px-1.5 hyphens-auto [overflow-wrap:anywhere] tablet:px-4",
    plan === HIGHLIGHTED ? "on-hero border-border bg-hero text-on-hero" : "border-card-line",
  );

// `canBuy` : dans l'app, le propriétaire paie ici. Sinon, chaque offre mène à la création de l'espace.
export const PricingGrid = ({
  current,
  canBuy = false,
  billingEnabled = true,
  signupOpen = true,
  initialInterval = "year",
  suggested,
}: {
  current?: PlanKey;
  canBuy?: boolean;
  billingEnabled?: boolean;
  signupOpen?: boolean;
  initialInterval?: BillingInterval;
  // L'offre choisie sur le site : elle reste à portée de main, sans paiement déclenché tout seul.
  suggested?: PlanKey;
}) => {
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const checkout = useAction(checkoutAction, {
    onSuccess: ({ data }) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });

  const action = (key: (typeof SOLD)[number]): ReactNode => {
    const label = m.billing.plans[key];
    const variant = key === (suggested ?? HIGHLIGHTED) ? "primary" : "secondary";
    const buttonClass =
      "w-full whitespace-normal px-0.5 text-[13px] leading-4 tablet:px-4 tablet:text-[15px] tablet:leading-5";
    if (current === key) return <p className="flex min-h-11 items-center font-semibold">{m.billing.current}</p>;
    if (canBuy && key === "discovery") return null;
    if (canBuy && billingEnabled && key !== "discovery") {
      return (
        <Button
          size="sm"
          variant={variant}
          className={buttonClass}
          disabled={checkout.isPending}
          onClick={() => checkout.execute({ plan: key, interval })}
        >
          {suggested === key ? m.billing.continueToPayment : m.billing.choose(label)}
        </Button>
      );
    }
    // Tant que la vente et les inscriptions sont fermées, chaque offre mène à une prise de contact.
    const contact = canBuy || !signupOpen || (key !== "discovery" && !billingEnabled);
    return (
      <Button asChild size="sm" variant={variant} className={buttonClass}>
        {contact ? (
          <Link href="/contact">{m.billing.contactUs}</Link>
        ) : (
          // Une vraie navigation : depuis le site, la création d'espace vit sur un autre domaine.
          <a
            href={
              key === "discovery"
                ? "/connexion?creer=1"
                : `/connexion?creer=1&next=${encodeURIComponent(`/bienvenue?offre=${key}&rythme=${interval}`)}`
            }
          >
            {key === "discovery" ? m.billing.startFree : m.billing.choose(label)}
          </a>
        )}
      </Button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={m.billing.interval} className="flex flex-wrap items-center gap-2">
        {(["month", "year"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={interval === key}
            onClick={() => setInterval(key)}
            className={cn(
              "min-h-11 rounded-full border-2 border-on-page px-4 font-semibold",
              interval === key ? "bg-accent text-on-accent" : "text-on-page hover:bg-raise",
            )}
          >
            {key === "month" ? m.billing.monthly : m.billing.yearly}
          </button>
        ))}
        <span className="font-medium">{m.billing.twoMonthsFree}</span>
      </div>
      <Sheet>
        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">{m.billing.compare.caption}</caption>
          <colgroup>
            <col className="w-[23%] desktop:w-[22%]" />
          </colgroup>
          <thead>
            <tr>
              <td className="px-2 tablet:px-4" />
              {SOLD.map((key) => {
                const price = PLANS[key].prices?.[interval] ?? null;
                return (
                  <th key={key} scope="col" className={cn(cellClass(key), "pb-3 pt-4 align-top font-normal")}>
                    <span className="block whitespace-nowrap font-display text-[14px] font-semibold leading-5 min-[400px]:text-[16px] tablet:text-[24px] tablet:leading-7 desktop:text-[26px] desktop:leading-[30px]">
                      {m.billing.plans[key]}
                    </span>
                    <span className="t-num mt-2 block whitespace-nowrap text-[20px] leading-7 min-[400px]:text-[24px] tablet:text-[34px] tablet:leading-10 desktop:text-[48px] desktop:leading-[52px]">
                      {price === null ? m.billing.free : formatPrice(price)}
                    </span>
                    <span className="t-caption block font-normal text-soft">
                      {price === null ? " " : interval === "month" ? m.billing.perMonth : m.billing.perYear}
                    </span>
                    <span className="t-caption mt-2 block font-normal text-soft">{m.billing.planLead[key]}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="t-col hyphens-auto border-t border-card-line px-2 py-2.5 tablet:px-4">
                  {row.label}
                </th>
                {SOLD.map((key) => (
                  <td key={key} className={cn(cellClass(key), "border-t py-2.5 text-[13px] font-medium leading-[18px] tablet:text-base tablet:leading-6")}>
                    {row.value(key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-2 tablet:px-4" />
              {SOLD.map((key) => (
                <td key={key} className={cn(cellClass(key), "pb-4 pt-3 align-top")}>
                  {action(key)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </Sheet>
    </div>
  );
};

export const ManageSubscriptionButton = () => {
  const portal = useAction(portalAction, {
    onSuccess: ({ data }) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  return (
    <Button size="sm" variant="secondary" disabled={portal.isPending} onClick={() => portal.execute()}>
      {m.billing.manage}
    </Button>
  );
};
