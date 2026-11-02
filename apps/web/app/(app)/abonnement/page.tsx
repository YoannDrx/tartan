import type { Metadata } from "next";
import { isPaidPlan, type LimitKey } from "@tartan/domain";
import { m, withFirstOfMonth } from "@tartan/i18n";
import { Sheet, SheetSection } from "@/components/sheet";
import { Chip, PageHeader } from "@/components/states";
import { ManageSubscriptionButton, PricingGrid } from "@/features/billing/pricing";
import { requireStaffSpace } from "@/features/shell/space";
import { getBillingOverview } from "@/server/billing.service";

export const metadata: Metadata = { title: m.billing.title };

const LIMITS: LimitKey[] = ["maxAthletes", "maxGroups", "maxCoaches", "maxVideosPerMonth"];

const longDate = (iso: string) =>
  withFirstOfMonth(
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(iso)),
  );

export default async function AbonnementPage({ searchParams }: { searchParams: Promise<{ merci?: string }> }) {
  const { actor, organizationId } = await requireStaffSpace();
  const { merci } = await searchParams;
  const billing = await getBillingOverview(actor.userId, organizationId);
  const paid = isPaidPlan(billing.plan);
  const store = billing.provider === "revenuecat";
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.billing.title} detail={m.billing.planLead[billing.plan]} />
      {merci ? (
        <p role="status" className="on-card rounded-card bg-card p-3 font-semibold">
          {m.billing.thanks}
        </p>
      ) : null}
      <Sheet className="divide-y divide-card-line">
        <SheetSection
          title={m.billing.plans[billing.plan]}
          aside={paid ? <Chip>{m.billing.status[billing.status]}</Chip> : null}
          action={billing.canManage && billing.hasCustomer && !store ? <ManageSubscriptionButton /> : null}
        >
          {billing.status === "past_due" ? <p className="text-alert">{m.billing.pastDueHint}</p> : null}
          {paid && billing.cancelAt ? <p>{m.billing.endsOn(longDate(billing.cancelAt))}</p> : null}
          {paid && !billing.cancelAt && billing.currentPeriodEnd ? (
            <p className="text-soft">{m.billing.until(longDate(billing.currentPeriodEnd))}</p>
          ) : null}
          {store ? <p className="text-soft">{m.billing.storeHint}</p> : null}
          {billing.canManage && billing.hasCustomer && !store ? (
            <p className="t-caption font-normal text-soft">{m.billing.manageHint}</p>
          ) : null}
          <dl className="mt-3 grid gap-3 tablet:grid-cols-2">
            {LIMITS.map((key) => {
              const limit = billing.limits[key];
              const used = billing.usage[key];
              return (
                <div key={key}>
                  <dt className="t-caption text-soft">{m.billing.usage[key]}</dt>
                  <dd className="t-num text-[24px]">
                    {used}
                    {limit === null ? "" : ` / ${limit}`}
                    {limit === null ? null : (
                      <progress
                        value={Math.min(used, limit)}
                        max={limit}
                        aria-label={m.billing.usage[key]}
                        className="meter mt-1"
                      />
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </SheetSection>
      </Sheet>
      {billing.plan !== "pilot" && billing.canManage && !store ? (
        <>
          {!billing.billingEnabled ? <p>{m.billing.disabled}</p> : null}
          <PricingGrid current={billing.plan} canBuy billingEnabled={billing.billingEnabled} />
        </>
      ) : null}
      <p>{m.billing.safetyFree}</p>
    </div>
  );
}
