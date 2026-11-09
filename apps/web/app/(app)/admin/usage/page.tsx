import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { AdminNav, DataTable, Metrics } from "@/features/admin/console-ui";
import { requireSpace } from "@/features/shell/space";
import { usageOverview } from "@/server/admin-console.service";

export default async function AdminUsagePage() {
  const { actor } = await requireSpace();
  const data = await usageOverview(actor);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.admin.nav.usage} />
      <AdminNav current="/admin/usage" />
      <Metrics
        items={[
          { label: "Comptes", value: data.users },
          { label: "Actifs sur 7 jours", value: data.active7 },
          { label: "Actifs sur 30 jours", value: data.active30 },
          { label: "Espaces payants", value: `${data.paidSpaces} / ${data.spaces}` },
          { label: "Séances publiées, 7 jours", value: data.publishedWeek },
          { label: "Séances validées, 7 jours", value: data.validatedWeek },
          { label: "Vidéos", value: data.videos },
          { label: "Opérations IA, 30 jours", value: data.aiOperations },
        ]}
      />
      <DataTable
        caption="Entonnoir d'activation"
        columns={["Étape", "Espaces"]}
        rows={[
          ["Espace créé", data.funnel.spaces],
          ["Premier athlète", data.funnel.withAthlete],
          ["Première séance publiée", data.funnel.withSession],
          ["Première validation", data.funnel.withLog],
          ["Abonnement payant", data.funnel.paidSpaces],
        ]}
      />
      <DataTable
        caption="Versions installées, 30 jours"
        columns={["Plateforme", "Version", "Installations"]}
        rows={data.versions.map((row) => [m.admin.platformName(row.platform), row.version, row.count])}
      />
    </div>
  );
}
