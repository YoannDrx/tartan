import { m } from "@tartan/i18n";
import Link from "next/link";
import { PageHeader } from "@/components/states";
import { requireSpace } from "@/features/shell/space";
import { AdminNav, DataTable, day, Metrics } from "@/features/admin/console-ui";
import { UserActions } from "@/features/admin/console-actions";
import { userCard } from "@/server/admin-console.service";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireSpace();
  const { id } = await params;
  const user = await userCard(actor, id);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={user.email} detail={user.name} />
      <AdminNav current="/admin/utilisateurs" />
      <Metrics
        items={[
          { label: "Inscription", value: day(user.createdAt) },
          { label: "Dernière activité", value: day(user.profile?.lastActiveAt) },
          { label: "Adresse vérifiée", value: user.emailVerified ? "Oui" : "Non" },
          { label: "État", value: user.suspendedAt ? "Suspendu" : "Actif" },
        ]}
      />
      <UserActions userId={user.id} suspended={Boolean(user.suspendedAt)} self={user.id === actor.userId} />
      <DataTable
        caption="Espaces"
        columns={["Espace", "Rôle", "Offre", "Statut"]}
        rows={user.memberships.map((row) => [
          <Link key="name" href={`/admin/espaces/${row.organization.id}`}>
            {row.organization.name}
          </Link>,
          m.roles[row.role],
          m.billing.plans[row.organization.plan as keyof typeof m.billing.plans],
          row.status,
        ])}
      />
      <DataTable
        caption="Appareils et versions"
        columns={["Plateforme", "Version", "Vu le"]}
        rows={user.clientInstallations.map((row) => [row.platform, row.appVersion, day(row.lastSeenAt)])}
      />
    </div>
  );
}
