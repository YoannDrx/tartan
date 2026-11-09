import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { MinimumVersionForm, ReleaseActions } from "@/features/admin/console-actions";
import { AdminNav, DataTable, day } from "@/features/admin/console-ui";
import { requireSpace } from "@/features/shell/space";
import { releasesConsole } from "@/server/admin-console.service";

export default async function AdminVersionsPage() {
  const { actor } = await requireSpace();
  const data = await releasesConsole(actor);
  const minimum = (platform: string) => data.configs.find((row) => row.platform === platform)?.minimumVersion ?? null;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.admin.nav.versions} />
      <AdminNav current="/admin/versions" />
      <DataTable
        caption={m.admin.nav.versions}
        columns={["Version", "Plateforme", "Canal", "État", "Disponible le", "Notifiés", "Actions"]}
        rows={data.targets.map((row) => [
          row.version,
          row.platform,
          row.delivery,
          row.state,
          day(row.availableAt),
          row.notifiedCount,
          <ReleaseActions
            key="a"
            id={row.id}
            canConfirm={row.state === "awaiting_store"}
            canStop={row.delivery === "store" && ["available", "rolling_out"].includes(row.state)}
          />,
        ])}
      />
      <DataTable
        caption="Appareils notifiables"
        columns={["Plateforme", "Version", "Appareils"]}
        rows={data.devices.map((row) => [
          m.admin.platformName(row.platform),
          row.version ?? "antérieure au suivi",
          row.count,
        ])}
      />
      <div className="on-card flex flex-col gap-4 rounded-card bg-card p-4">
        <MinimumVersionForm platform="ios" current={minimum("ios")} />
        <MinimumVersionForm platform="android" current={minimum("android")} />
      </div>
    </div>
  );
}
