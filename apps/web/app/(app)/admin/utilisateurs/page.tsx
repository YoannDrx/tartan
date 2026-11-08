import { m } from "@tartan/i18n";
import Link from "next/link";
import { PageHeader } from "@/components/states";
import { requireSpace } from "@/features/shell/space";
import { AdminNav, DataTable, day, NextPage, SearchBox } from "@/features/admin/console-ui";
import { searchUsers } from "@/server/admin-console.service";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; apres?: string }> }) {
  const { actor } = await requireSpace();
  const { q, apres } = await searchParams;
  const data = await searchUsers(actor, { q, cursor: apres });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.admin.nav.users} />
      <AdminNav current="/admin/utilisateurs" />
      <SearchBox action="/admin/utilisateurs" value={q} label={m.admin.searchUsers} />
      <DataTable
        caption={m.admin.nav.users}
        columns={["E-mail", "Nom", "Inscription", "Dernière activité", "État"]}
        rows={data.items.map((user) => [
          <Link key="email" href={`/admin/utilisateurs/${user.id}`}>
            {user.email}
          </Link>,
          user.name,
          day(user.createdAt),
          day(user.profile?.lastActiveAt),
          user.suspendedAt ? "Suspendu" : "Actif",
        ])}
      />
      <NextPage
        href={data.nextCursor ? `/admin/utilisateurs?apres=${data.nextCursor}${q ? `&q=${encodeURIComponent(q)}` : ""}` : null}
      />
    </div>
  );
}
