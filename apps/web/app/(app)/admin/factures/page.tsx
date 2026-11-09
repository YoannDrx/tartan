import { m } from "@tartan/i18n";
import Link from "next/link";
import { PageHeader } from "@/components/states";
import { requireSpace } from "@/features/shell/space";
import { AdminNav, DataTable, day, euros, NextPage } from "@/features/admin/console-ui";
import { listInvoices } from "@/server/admin-console.service";
import { listRefunds } from "@/server/billing-refund.service";

export default async function AdminInvoicesPage({ searchParams }: { searchParams: Promise<{ apres?: string }> }) {
  const { actor } = await requireSpace();
  const { apres } = await searchParams;
  const [data, refunds] = await Promise.all([listInvoices(actor, { cursor: apres }), listRefunds(actor)]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.admin.nav.invoices} />
      <AdminNav current="/admin/factures" />
      <DataTable
        caption={m.admin.nav.invoices}
        columns={["Numéro", "Espace", "Date", "Total", "Encaissé", "Remboursé", "État"]}
        rows={data.items.map((row) => [
          <Link key="n" href={`/admin/factures/${row.id}`}>
            {row.number ?? row.id}
          </Link>,
          row.space ?? "–",
          day(row.paidAt ?? row.stripeCreatedAt),
          euros(row.totalCents),
          euros(row.amountPaidCents),
          euros(row.refundedCents),
          row.livemode ? row.status : `${row.status} (test)`,
        ])}
      />
      <NextPage href={data.nextCursor ? `/admin/factures?apres=${data.nextCursor}` : null} />
      <h2 className="t-h2">Remboursements</h2>
      <DataTable
        caption="Remboursements"
        columns={["Facture", "Montant", "Motif", "État", "Date"]}
        rows={refunds.map((row) => [
          row.invoiceId,
          euros(row.amountCents),
          m.admin.refundReasons[row.reasonCode as keyof typeof m.admin.refundReasons],
          row.state,
          day(row.completedAt ?? row.createdAt),
        ])}
      />
    </div>
  );
}
