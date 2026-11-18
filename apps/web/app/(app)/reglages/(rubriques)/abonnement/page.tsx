import type { Metadata } from "next";
import Link from "next/link";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Sheet, SheetSection } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { ReferralSection } from "@/features/settings/referral-section";
import { loadReferral, requireRubric } from "@/features/settings/rubric-access";
import { getOrganization } from "@/server/org.service";

export const metadata: Metadata = { title: w.settings.rubrics.abonnement.title };

// Le résumé de l'offre ; le détail, les factures et le changement d'offre restent sur `/abonnement`.
export default async function AbonnementSettingsPage() {
  const { actor, organizationId } = await requireRubric("abonnement");
  const [organization, referral] = await Promise.all([
    getOrganization(actor.userId, organizationId),
    loadReferral(actor.userId),
  ]);
  return (
    <Sheet className="divide-y divide-card-line">
      <SheetSection id="offre" title={w.settings.abonnement.current(m.billing.plans[organization.plan])}>
        <div className="flex flex-col items-start gap-3">
          <p className="max-w-prose">{m.billing.planLead[organization.plan]}</p>
          <Button asChild size="sm" variant="secondary">
            <Link href="/abonnement">{m.settings.planOpen}</Link>
          </Button>
        </div>
      </SheetSection>
      {referral ? <ReferralSection referral={referral} athlete={false} /> : null}
    </Sheet>
  );
}
