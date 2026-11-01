"use client";

import { formatPrice, PLANS, TRIAL_DAYS, type BillingInterval, type PlanKey } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Check } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { checkoutAction, portalAction } from "./billing.action";

const SOLD: ("discovery" | "coach" | "club")[] = ["discovery", "coach", "club"];

const featuresOf = (plan: PlanKey): string[] => {
  const { limits } = PLANS[plan];
  return [
    limits.maxAthletes === null ? m.billing.athletesUnlimited : m.billing.athletesUpTo(limits.maxAthletes),
    limits.maxGroups === null ? m.billing.groupsUnlimited : m.billing.groupsUpTo(limits.maxGroups),
    limits.maxCoaches === null ? m.billing.coachesUnlimited : m.billing.coachesUpTo(limits.maxCoaches),
    limits.maxVideosPerMonth === null ? m.billing.videosUnlimited : m.billing.videosPerMonth(limits.maxVideosPerMonth),
    limits.videoRetentionDays === null
      ? m.billing.videoRetentionForever
      : m.billing.videoRetention(limits.videoRetentionDays),
  ];
};

// `canBuy` : dans l'app, le propriétaire paie ici. Sinon, chaque offre mène à la création de l'espace.
export const PricingGrid = ({
  current,
  canBuy = false,
  billingEnabled = true,
}: {
  current?: PlanKey;
  canBuy?: boolean;
  billingEnabled?: boolean;
}) => {
  const [interval, setInterval] = useState<BillingInterval>("year");
  const checkout = useAction(checkoutAction, {
    onSuccess: ({ data }) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
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
              interval === key ? "bg-white text-ink" : "text-white hover:bg-brand-strong",
            )}
          >
            {key === "month" ? m.billing.monthly : m.billing.yearly}
          </button>
        ))}
        <span className="font-medium">{m.billing.twoMonthsFree}</span>
      </div>
      <ul className="grid items-stretch gap-4 desktop:grid-cols-3">
        {SOLD.map((key) => {
          const plan = PLANS[key];
          const price = plan.prices?.[interval] ?? null;
          const highlighted = key === "coach";
          const label = m.billing.plans[key];
          return (
            <li
              key={key}
              className={cn(
                "flex flex-col gap-4 rounded-card p-5",
                highlighted ? "on-hero bg-hero text-on-hero" : "on-card bg-card",
              )}
            >
              <div>
                <h2 className="t-h2">{label}</h2>
                <p className="mt-1 text-ctx-soft">{m.billing.planLead[key]}</p>
              </div>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="t-num text-[48px] leading-none">
                  {price === null ? m.billing.free : formatPrice(price)}
                </span>
                {price === null ? null : (
                  <span className="text-ctx-soft">{interval === "month" ? m.billing.perMonth : m.billing.perYear}</span>
                )}
              </p>
              <ul className="flex flex-1 flex-col gap-2">
                {featuresOf(key).map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check aria-hidden className="mt-1 size-4 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              {price !== null ? (
                <p className="t-caption font-normal text-ctx-soft">{m.billing.trial(TRIAL_DAYS)}</p>
              ) : null}
              {current === key ? (
                <p className="flex min-h-11 items-center font-semibold">{m.billing.current}</p>
              ) : !canBuy ? (
                <Button asChild variant={highlighted ? "primary" : "secondary"}>
                  <Link href={key === "discovery" ? "/connexion" : "/connexion?next=/abonnement"}>
                    {key === "discovery" ? m.billing.startFree : m.billing.choose(label)}
                  </Link>
                </Button>
              ) : key === "discovery" ? null : (
                <Button
                  variant={highlighted ? "primary" : "secondary"}
                  disabled={!billingEnabled || checkout.isPending}
                  onClick={() => checkout.execute({ plan: key, interval })}
                >
                  {m.billing.choose(label)}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
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
