import { m } from "@tartan/i18n";
import Link from "next/link";
import { PageHeader } from "@/components/states";
import { requireSpace } from "@/features/shell/space";
import { AdminNav, DataTable, euros, Metrics } from "@/features/admin/console-ui";
import { revenueOverview } from "@/server/admin-console.service";

const pct = (value: number | null) => (value === null ? "–" : `${value} %`);

export default async function AdminRevenuePage() {
  const { actor } = await requireSpace();
  const data = await revenueOverview(actor);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.admin.nav.revenue} />
      <AdminNav current="/admin/revenus" />
      <Metrics
        items={[
          { label: "MRR", value: euros(data.mrrCents) },
          { label: "ARR", value: euros(data.arrCents) },
          { label: "Payants", value: data.paying },
          { label: "En essai", value: data.trialing },
          { label: "Conversion des essais", value: pct(data.conversionPercent) },
          { label: "Churn du mois", value: pct(data.churnPercent) },
          { label: "Impayés", value: `${data.pastDue} (${euros(data.atRiskCents)})` },
          { label: "Encaissé ce mois", value: euros(data.monthRevenueCents) },
          { label: "Remboursé ce mois", value: euros(data.monthRefundedCents) },
          { label: "CA de l'année, net", value: euros(data.yearRevenueCents) },
        ]}
      />
      <p>
        <Link href={`/admin/revenus/export?annee=${new Date().getUTCFullYear()}`}>Export comptable CSV</Link>
      </p>
      <DataTable
        caption="Évolution du revenu"
        columns={["Jour", "MRR", "Payants"]}
        rows={data.history.slice(-30).reverse().map((row) => [row.day, euros(row.mrrCents), row.paying])}
      />
    </div>
  );
}
