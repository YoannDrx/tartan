import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { AnnouncementComposer, AnnouncementList } from "@/features/announcements/announcements";
import { requireSpace } from "@/features/shell/space";
import { requireOrgMember } from "@/server/access";
import { listAnnouncements } from "@/server/comm.service";
import { listGroups } from "@/server/org.service";

export const metadata: Metadata = { title: m.announcements.title };

export default async function AnnoncesPage() {
  const { actor, organizationId, staff } = await requireSpace();
  const items = await listAnnouncements(actor.userId, organizationId);
  const groups = staff
    ? await listGroups(await requireOrgMember(actor.userId, organizationId, "publishAnnouncement"))
    : [];
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={m.announcements.title} />
      {staff && groups.length > 0 ? <AnnouncementComposer groups={groups} /> : null}
      <AnnouncementList items={items} canManage={staff} />
    </div>
  );
}
