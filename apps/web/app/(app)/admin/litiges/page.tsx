import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { AdminNav, DataTable, day, euros } from "@/features/admin/console-ui";
import { requireSpace } from "@/features/shell/space";
import { listDisputes } from "@/server/admin-console.service";

export default async function AdminDisputesPage() {
  const { actor } = await requireSpace();
  const disputes = await listDisputes(actor);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.admin.nav.disputes} />
      <AdminNav current="/admin/litiges" />
      <DataTable
        caption={m.admin.nav.disputes}
        columns={["Ouvert le", "Montant", "Motif", "État", "Réponse avant", "Stripe"]}
        rows={disputes.map((row) => [
          day(row.createdAt),
          euros(row.amountCents),
          row.reason,
          row.status,
          day(row.dueBy),
          <a
            key="s"
            href={`https://dashboard.stripe.com/${row.livemode ? "" : "test/"}disputes/${row.id}`}
            rel="noreferrer"
            target="_blank"
          >
            Ouvrir
          </a>,
        ])}
      />
    </div>
  );
}
