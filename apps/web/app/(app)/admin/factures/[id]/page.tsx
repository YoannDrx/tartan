import { refundableCents, withdrawalWindow } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { RefundForm } from "@/features/admin/console-actions";
import { AdminNav, day, euros, Metrics } from "@/features/admin/console-ui";
import { requireSpace } from "@/features/shell/space";
import { invoiceCard } from "@/server/admin-console.service";

export default async function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireSpace();
  const { id } = await params;
  const { invoice, subscription, pdfUrl } = await invoiceCard(actor, id);
  const remaining = refundableCents(invoice.amountPaidCents, invoice.refundedCents);
  const window = subscription?.startedAt ? withdrawalWindow(subscription.startedAt, new Date()) : null;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={invoice.number ?? invoice.id} detail={invoice.status} />
      <AdminNav current="/admin/factures" />
      {!invoice.livemode ? <p role="status">{m.admin.testMode}</p> : null}
      <Metrics
        items={[
          { label: "Total", value: euros(invoice.totalCents) },
          { label: "Encaissé", value: euros(invoice.amountPaidCents) },
          { label: "Remboursé", value: euros(invoice.refundedCents) },
          { label: "Reste remboursable", value: euros(remaining) },
          { label: "Payée le", value: day(invoice.paidAt) },
        ]}
      />
      {pdfUrl ? (
        <p>
          <a href={pdfUrl}>Télécharger la facture PDF</a>
        </p>
      ) : null}
      {window ? (
        <p>
          {window.open ? m.admin.withdrawalOpen(day(window.endsAt)) : m.admin.withdrawalClosed(day(window.endsAt))}{" "}
          {m.admin.withdrawalHint}
        </p>
      ) : null}
      {remaining > 0 ? (
        <div className="on-card rounded-card bg-card p-4">
          <RefundForm invoiceId={invoice.id} refundableCents={remaining} withdrawalOpen={window?.open ?? false} />
        </div>
      ) : null}
    </div>
  );
}
