import type { BillingInterval, PlanKey } from "@tartan/domain";
import Stripe from "stripe";
import { env } from "./env";

export const billingEnabled = (): boolean => Boolean(env().STRIPE_SECRET_KEY);

export const stripe = (): Stripe =>
  new Stripe(env().STRIPE_SECRET_KEY ?? "", { timeout: 10_000, maxNetworkRetries: 1 });

export const priceIdFor = (plan: PlanKey, interval: BillingInterval): string | undefined => {
  const e = env();
  if (plan === "coach") return interval === "month" ? e.STRIPE_PRICE_COACH_MONTH : e.STRIPE_PRICE_COACH_YEAR;
  if (plan === "club") return interval === "month" ? e.STRIPE_PRICE_CLUB_MONTH : e.STRIPE_PRICE_CLUB_YEAR;
  return undefined;
};

export const planForPriceId = (priceId: string | undefined): PlanKey | null => {
  if (!priceId) return null;
  const e = env();
  if (priceId === e.STRIPE_PRICE_COACH_MONTH || priceId === e.STRIPE_PRICE_COACH_YEAR) return "coach";
  if (priceId === e.STRIPE_PRICE_CLUB_MONTH || priceId === e.STRIPE_PRICE_CLUB_YEAR) return "club";
  return null;
};
