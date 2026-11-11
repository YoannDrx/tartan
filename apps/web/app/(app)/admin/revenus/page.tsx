import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { requireSpace } from "@/features/shell/space";
import { AdminNav, DataTable, euros, Metrics } from "@/features/admin/console-ui";
import { revenueOverview } from "@/server/admin-console.service";

const t = m.admin.revenue;
const pct = (value: number | null) => (value === null ? "–" : `${value} %`);

export default async function AdminRevenuePage() {
  const { actor } = await requireSpace();
  const data = await revenueOverview(actor);
  const year = new Date().getUTCFullYear();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.admin.nav.revenue} />
      <AdminNav current="/admin/revenus" />
      <Metrics
        items={[
          { label: t.mrr, value: euros(data.mrrCents) },
          { label: t.arr, value: euros(data.arrCents) },
          { label: t.paying, value: data.paying },
          { label: t.trialing, value: data.trialing },
          { label: t.conversion, value: pct(data.conversionPercent) },
          { label: t.churn, value: pct(data.churnPercent) },
          { label: t.pastDue, value: `${data.pastDue} (${euros(data.atRiskCents)})` },
          { label: t.collected, value: euros(data.monthRevenueCents) },
          { label: t.refunded, value: euros(data.monthRefundedCents) },
          { label: t.yearNet, value: euros(data.yearRevenueCents) },
        ]}
      />
      <p>
        {/* Un lien simple : un lien Next préchargerait l'export à chaque visite de la page. */}
        <a href={`/admin/revenus/export?annee=${year}`} download>
          {t.exportCsv(year)}
        </a>
      </p>
      <DataTable
        caption={t.historyCaption}
        columns={[t.day, t.mrr, t.paying]}
        rows={data.history
          .slice(-30)
          .reverse()
          .map((row) => [row.day, euros(row.mrrCents), row.paying])}
      />
    </div>
  );
}
