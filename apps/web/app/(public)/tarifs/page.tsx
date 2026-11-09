import type { Metadata } from "next";
import { PLANS } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { env } from "@/lib/env";
import { billingEnabled } from "@/lib/stripe";
import { PricingGrid } from "@/features/billing/pricing";
import { PublicPage } from "@/features/shell/public-page";

export const metadata: Metadata = {
  title: m.billing.pricing,
  description: `Découverte gratuite, Coach à ${PLANS.coach.prices?.month} € par mois, Club à ${PLANS.club.prices?.month} € par mois. Les athlètes ne paient jamais.`,
};

export default function TarifsPage() {
  return (
    <PublicPage world="couloir" title={m.billing.pricingTitle} lead={m.billing.athleteFree} width="wide" site>
      <div className="flex flex-col gap-4">
        {!billingEnabled() ? <p className="font-semibold">{m.billing.disabled}</p> : null}
        <PricingGrid billingEnabled={billingEnabled()} signupOpen={env().COACH_SIGNUP_MODE === "public"} />
        <p>{m.billing.safetyFree}</p>
        <p className="t-caption font-normal">{m.billing.taxNote}</p>
      </div>
    </PublicPage>
  );
}
