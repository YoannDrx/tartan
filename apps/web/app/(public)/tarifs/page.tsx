import type { Metadata } from "next";
import { formatPrice, PLANS } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { billingEnabled } from "@/lib/stripe";
import { PricingGrid } from "@/features/billing/pricing";
import { PublicPage } from "@/features/shell/public-page";
import { platformSettings } from "@/server/platform-settings.service";

export const metadata: Metadata = {
  title: m.billing.pricing,
  description: `Découverte gratuite, Coach à ${formatPrice(PLANS.coach.prices?.month ?? 0)} par mois, Club à ${formatPrice(PLANS.club.prices?.month ?? 0)} par mois. Les athlètes ne paient jamais.`,
};

// Réglable depuis la console : la page se recalcule au plus tard chaque minute.
export const revalidate = 60;

export default async function TarifsPage() {
  const settings = await platformSettings();
  const sellable = billingEnabled() && settings.checkoutEnabled;
  return (
    <PublicPage world="couloir" title={m.billing.pricingTitle} lead={m.billing.athleteFree} width="wide" site>
      <div className="flex flex-col gap-4">
        {!sellable ? <p className="font-semibold">{m.billing.disabled}</p> : null}
        <PricingGrid billingEnabled={sellable} signupOpen={settings.signupMode === "public"} />
        <p>{m.billing.safetyFree}</p>
        <p className="t-caption font-normal">{m.billing.taxNote}</p>
      </div>
    </PublicPage>
  );
}
