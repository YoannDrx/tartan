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
  const composing = staff && groups.length > 0;
  return (
    <div className="flex flex-col gap-4">
      {composing ? (
        <PageHeader title={m.announcements.title} />
      ) : (
        <div className="mx-auto w-full max-w-2xl">
          <PageHeader title={m.announcements.title} />
        </div>
      )}
      <div
        className={
          composing
            ? "grid items-start gap-4 desktop:grid-cols-[minmax(0,1fr)_380px] desktop:gap-6"
            : "mx-auto w-full max-w-2xl"
        }
      >
        {composing ? (
          <div className="desktop:sticky desktop:top-20 desktop:col-start-2 desktop:row-start-1">
            <AnnouncementComposer groups={groups} />
          </div>
        ) : null}
        <div className="min-w-0 desktop:col-start-1 desktop:row-start-1">
          <AnnouncementList items={items} canManage={staff} />
        </div>
      </div>
    </div>
  );
}
