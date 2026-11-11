import type { Metadata } from "next";
import { z } from "zod";
import { formatPrice, isPaidPlan, type LimitKey } from "@tartan/domain";
import { m, withFirstOfMonth } from "@tartan/i18n";
import { Sheet, SheetSection } from "@/components/sheet";
import { Chip, PageHeader } from "@/components/states";
import { ManageSubscriptionButton, PricingGrid } from "@/features/billing/pricing";
import { requireStaffSpace } from "@/features/shell/space";
import { getBillingOverview, listInvoices, syncAfterCheckout } from "@/server/billing.service";

export const metadata: Metadata = { title: m.billing.title };

const LIMITS: LimitKey[] = ["maxAthletes", "maxGroups", "maxCoaches", "maxVideosPerMonth"];

const longDate = (iso: string) =>
  withFirstOfMonth(
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(iso)),
  );

// Un état que Stripe ajouterait un jour s'affiche tel quel plutôt que de casser la page.
const invoiceStatus = (status: string): string =>
  status in m.billing.invoices.status
    ? m.billing.invoices.status[status as keyof typeof m.billing.invoices.status]
    : status;

const offerSchema = z.object({
  offre: z.enum(["coach", "club"]).optional().catch(undefined),
  rythme: z.enum(["month", "year"]).optional().catch(undefined),
});

export default async function AbonnementPage({
  searchParams,
}: {
  searchParams: Promise<{ merci?: string; offre?: string; rythme?: string }>;
}) {
  const { actor, organizationId } = await requireStaffSpace();
  const { merci, ...query } = await searchParams;
  const { offre, rythme } = offerSchema.parse(query);
  // Le retour de paiement peut précéder le webhook : on relit Stripe plutôt que de montrer une grille d'achat.
  if (merci) await syncAfterCheckout(actor.userId, organizationId);
  const billing = await getBillingOverview(actor.userId, organizationId);
  const confirming = Boolean(merci) && !isPaidPlan(billing.plan);
  const paid = isPaidPlan(billing.plan);
  const store = billing.provider === "revenuecat";
  const invoices =
    billing.canManage && billing.hasCustomer && !store ? await listInvoices(actor.userId, organizationId) : null;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.billing.title} detail={m.billing.planLead[billing.plan]} />
      {merci ? (
        <p role="status" className="on-card rounded-card bg-card p-3 font-semibold">
          {confirming ? m.billing.confirming : m.billing.thanks}
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
          {paid && !billing.cancelAt && billing.currentPeriodEnd && billing.status !== "past_due" ? (
            <p className="text-soft">{m.billing.until(longDate(billing.currentPeriodEnd))}</p>
          ) : null}
          {store ? <p className="text-soft">{m.billing.storeHint}</p> : null}
          {billing.billingTransferred ? <p role="status">{m.billing.transferred}</p> : null}
          {billing.billingReview ? <p role="status">{m.billing.checkoutReview}</p> : null}
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
        {invoices ? (
          <SheetSection title={m.billing.invoices.title} action={<ManageSubscriptionButton />}>
            {invoices.length === 0 ? (
              <p className="text-soft">{m.billing.invoices.empty}</p>
            ) : (
              <>
                <ul className="divide-y divide-card-line">
                  {invoices.map((invoice) => (
                    <li key={invoice.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                      <span className="min-w-0">
                        <span className="block font-semibold">{invoice.number ?? m.billing.invoices.pending}</span>
                        <span className="t-caption text-soft">{longDate(invoice.date)}</span>
                      </span>
                      <span className="flex items-baseline gap-3">
                        <span className="t-num">{formatPrice(invoice.totalCents)}</span>
                        <Chip>{invoiceStatus(invoice.status)}</Chip>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="t-caption font-normal text-soft">{m.billing.invoices.hint}</p>
              </>
            )}
          </SheetSection>
        ) : null}
      </Sheet>
      {billing.plan !== "pilot" &&
      billing.canManage &&
      !store &&
      !confirming &&
      !billing.billingTransferred &&
      !billing.billingReview ? (
        <>
          {!billing.billingEnabled ? <p>{m.billing.disabled}</p> : null}
          <PricingGrid
            current={billing.plan}
            canBuy
            billingEnabled={billing.billingEnabled}
            suggested={offre}
            initialInterval={rythme ?? "year"}
          />
        </>
      ) : null}
      <p>{m.billing.safetyFree}</p>
    </div>
  );
}
