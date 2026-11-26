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

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ apres?: string; filtre?: string }>;
}) {
  const { actor } = await requireSpace();
  const { apres, filtre } = await searchParams;
  const page = await listNotifications(actor.userId, {
    filter: filtre === "lues" ? "read" : "unread",
    cursor: uuid.safeParse(apres).success ? apres : undefined,
  });
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
      <nav className="flex gap-2" aria-label={m.inbox.title}>
        {(["non-lues", "lues"] as const).map((value) => {
          const selected = (filtre === "lues") === (value === "lues");
          return (
            <Button asChild key={value} variant={selected ? "primary" : "secondary"}>
              <Link aria-current={selected ? "page" : undefined} href={`/notifications?filtre=${value}`}>
                {value === "lues" ? m.inbox.readTab : m.inbox.unreadCount(page.unread)}
              </Link>
            </Button>
          );
        })}
      </nav>
      <NotificationList rows={rows} unread={page.unread} />
      {rows.length === 0 && <p className="on-card rounded-card bg-card p-4 text-soft">{m.inbox.empty}</p>}
      {page.nextCursor ? (
        <div>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/notifications?filtre=${filtre === "lues" ? "lues" : "non-lues"}&apres=${page.nextCursor}`}>
              {m.inbox.more}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
