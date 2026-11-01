import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { PricingGrid } from "@/features/billing/pricing";
import { PublicPage } from "@/features/shell/public-page";

export const metadata: Metadata = {
  title: m.billing.pricing,
  description: "Découverte gratuite, Coach à 19 € par mois, Club à 59 € par mois. Les athlètes ne paient jamais.",
};

export default function TarifsPage() {
  return (
    <PublicPage title={m.billing.pricingTitle} lead={m.billing.athleteFree} width="wide">
      <div className="flex flex-col gap-4">
        <PricingGrid />
        <p>{m.billing.safetyFree}</p>
        <p className="t-caption font-normal">{m.billing.taxNote}</p>
      </div>
    </PublicPage>
  );
}
