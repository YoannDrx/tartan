import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { AdminNav, DataTable, day, NextPage, SearchBox } from "@/features/admin/console-ui";
import { requireSpace } from "@/features/shell/space";
import { auditTrail } from "@/server/admin-console.service";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; apres?: string }>;
}) {
  const { actor } = await requireSpace();
  const { q, apres } = await searchParams;
  const data = await auditTrail(actor, { action: q, cursor: apres });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.admin.nav.audit} />
      <AdminNav current="/admin/journal" />
      <SearchBox action="/admin/journal" value={q} label={m.admin.filterAudit} />
      <DataTable
        caption={m.admin.nav.audit}
        columns={["Date", "Action", "Objet", "Détails"]}
        rows={data.items.map((row) => [
          day(row.at),
          row.action,
          `${row.entity}${row.entityId ? ` ${row.entityId.slice(0, 8)}` : ""}`,
          row.metadata ? JSON.stringify(row.metadata) : "–",
        ])}
      />
      <NextPage
        href={
          data.nextCursor ? `/admin/journal?apres=${data.nextCursor}${q ? `&q=${encodeURIComponent(q)}` : ""}` : null
        }
      />
    </div>
  );
}
