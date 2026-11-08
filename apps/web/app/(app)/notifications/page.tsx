import { uuid } from "@tartan/contracts";
import { capitalize, formatDateLong, m } from "@tartan/i18n";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/states";
import { NotificationList } from "@/features/notifications/notification-list";
import { requireSpace } from "@/features/shell/space";
import { todayIso } from "@/lib/dates";
import { listNotifications, webLink } from "@/server/notify.service";

export const metadata: Metadata = { title: m.inbox.title };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ apres?: string }> }) {
  const { actor } = await requireSpace();
  const { apres } = await searchParams;
  const page = await listNotifications(actor.userId, { cursor: uuid.safeParse(apres).success ? apres : undefined });
  const rows = page.items.map((item) => ({
    id: item.id,
    text: item.text,
    href: webLink(item.link ?? undefined, item.organizationId ?? undefined) ?? null,
    when: capitalize(formatDateLong(todayIso(new Date(item.createdAt)))),
    unread: item.readAt === null,
  }));
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title={m.inbox.title} />
      {rows.length === 0 ? (
        <p className="on-card rounded-card bg-card p-4 text-soft">{m.inbox.empty}</p>
      ) : (
        <NotificationList rows={rows} unread={page.unread} />
      )}
      {page.nextCursor ? (
        <div>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/notifications?apres=${page.nextCursor}`}>{m.inbox.more}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
