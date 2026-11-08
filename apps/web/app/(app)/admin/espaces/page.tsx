import { m } from "@tartan/i18n";
import Link from "next/link";
import { PageHeader } from "@/components/states";
import { requireSpace } from "@/features/shell/space";
import { AdminNav, DataTable, day, NextPage, SearchBox } from "@/features/admin/console-ui";
import { listSpaces } from "@/server/admin-console.service";

export default async function AdminSpacesPage({ searchParams }: { searchParams: Promise<{ q?: string; apres?: string }> }) {
  const { actor } = await requireSpace();
  const { q, apres } = await searchParams;
  const data = await listSpaces(actor, { q, cursor: apres });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.admin.nav.spaces} />
      <AdminNav current="/admin/espaces" />
      <SearchBox action="/admin/espaces" value={q} label={m.admin.searchSpaces} />
      <DataTable
        caption={m.admin.nav.spaces}
        columns={["Espace", "Propriétaire", "Offre", "Athlètes", "Vidéos", "Créé le"]}
        rows={data.items.map((org) => [
          <Link key="name" href={`/admin/espaces/${org.id}`}>
            {org.name}
          </Link>,
          org.owner.email,
          m.billing.plans[org.plan as keyof typeof m.billing.plans],
          org._count.athletes,
          org._count.videos,
          day(org.createdAt),
        ])}
      />
      <NextPage href={data.nextCursor ? `/admin/espaces?apres=${data.nextCursor}${q ? `&q=${encodeURIComponent(q)}` : ""}` : null} />
    </div>
  );
}
