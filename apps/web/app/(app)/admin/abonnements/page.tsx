import { m } from "@tartan/i18n";
import Link from "next/link";
import { PageHeader } from "@/components/states";
import { requireSpace } from "@/features/shell/space";
import { FilterPill } from "@/components/filter-pill";
import { AdminNav, DataTable, day, euros, NextPage } from "@/features/admin/console-ui";
import { SubscriptionActions } from "@/features/admin/console-actions";
import { listSubscriptions } from "@/server/admin-console.service";

const STATUSES = ["active", "trialing", "past_due", "canceled"] as const;
type Status = (typeof STATUSES)[number];
const isStatus = (value: string | undefined): value is Status => STATUSES.includes(value as Status);
const statusLabel = (value: string) => (isStatus(value) ? m.admin.subscriptionStatus[value] : value);

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string; apres?: string }>;
}) {
  const { actor } = await requireSpace();
  const { etat, apres } = await searchParams;
  const status = isStatus(etat) ? etat : undefined;
  const data = await listSubscriptions(actor, { status, cursor: apres });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.admin.nav.subscriptions} />
      <AdminNav current="/admin/abonnements" />
      <nav aria-label="État" className="flex flex-wrap gap-2">
        <FilterPill href="/admin/abonnements" active={!status}>
          Tous
        </FilterPill>
        {STATUSES.map((value) => (
          <FilterPill key={value} href={`/admin/abonnements?etat=${value}`} active={status === value}>
            {m.admin.subscriptionFilter[value]}
          </FilterPill>
        ))}
      </nav>
      <DataTable
        caption={m.admin.nav.subscriptions}
        columns={["Espace", "Offre", "État", "Mensuel", "Fin d'essai", "Échéance", "Actions"]}
        rows={data.items.map((row) => [
          <Link key="name" href={`/admin/espaces/${row.organization.id}`}>
            {row.organization.name}
          </Link>,
          `${row.planKey}${row.interval ? ` (${row.interval})` : ""}`,
          row.cancelAt ? `${statusLabel(row.status)}, fin le ${day(row.cancelAt)}` : statusLabel(row.status),
          euros(row.discountedMrrCents ?? row.listMrrCents),
          day(row.trialEndsAt),
          day(row.currentPeriodEnd),
          row.provider === "stripe" && row.status !== "canceled" ? (
            <SubscriptionActions key="a" subscriptionId={row.id} />
          ) : (
            "–"
          ),
        ])}
      />
      <NextPage
        href={data.nextCursor ? `/admin/abonnements?apres=${data.nextCursor}${status ? `&etat=${status}` : ""}` : null}
      />
    </div>
  );
}
