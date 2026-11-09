import { m } from "@tartan/i18n";
import Link from "next/link";
import { PageHeader } from "@/components/states";
import { requireSpace } from "@/features/shell/space";
import { AdminNav, DataTable, day, Metrics } from "@/features/admin/console-ui";
import { GrantPlan, SubscriptionActions } from "@/features/admin/console-actions";
import { spaceCard } from "@/server/admin-console.service";

export default async function AdminSpacePage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireSpace();
  const { id } = await params;
  const org = await spaceCard(actor, id);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={org.name} detail={org.owner.email} />
      <AdminNav current="/admin/espaces" />
      <Metrics
        items={[
          { label: m.admin.plan, value: m.billing.plans[org.plan as keyof typeof m.billing.plans] },
          { label: "Athlètes", value: org._count.athletes },
          { label: "Membres", value: org._count.members },
          { label: "Groupes", value: org._count.groups },
          { label: "Vidéos", value: org._count.videos },
          { label: "Créé le", value: day(org.createdAt) },
        ]}
      />
      {org.billingIssue ? <p role="status">{org.billingIssue}</p> : null}
      <GrantPlan organizationId={org.id} plan={org.plan} />
      <DataTable
        caption={m.admin.nav.subscriptions}
        columns={["Offre", "État", "Prestataire", "Échéance", "Actions"]}
        rows={org.subscriptions.map((row) => [
          row.planKey,
          row.status,
          row.provider,
          day(row.currentPeriodEnd),
          row.provider === "stripe" && row.status !== "canceled" ? (
            <SubscriptionActions key="a" subscriptionId={row.id} />
          ) : (
            "–"
          ),
        ])}
      />
    </div>
  );
}
