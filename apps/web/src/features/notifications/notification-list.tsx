"use client";

import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { NOTIFICATIONS_READ_EVENT } from "./notification-bell";
import { markNotificationsReadAction } from "./notifications.action";

export type InboxRow = { id: string; text: string; href: string | null; when: string; unread: boolean };

export const NotificationList = ({ rows, unread }: { rows: InboxRow[]; unread: number }) => {
  const router = useRouter();
  const mark = useAction(markNotificationsReadAction, {
    onSuccess: () => {
      window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
      router.refresh();
    },
  });
  return (
    <div className="flex flex-col gap-3">
      {unread > 0 ? (
        <div>
          <Button size="sm" variant="secondary" disabled={mark.isPending} onClick={() => mark.execute({ all: true })}>
            {m.inbox.markAll}
          </Button>
        </div>
      ) : null}
      <ul className="on-card divide-y divide-card-line overflow-hidden rounded-card bg-card">
        {rows.map((row) => {
          const content = (
            <>
              <span className={cn("min-w-0 flex-1 break-words leading-snug", row.unread && "font-semibold")}>
                {row.text}
                {row.unread ? <span className="sr-only">, {m.inbox.unread}</span> : null}
              </span>
              <span className="t-caption shrink-0 font-normal text-soft">{row.when}</span>
              {row.unread ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-link" /> : null}
            </>
          );
          const rowClass = "flex min-h-11 items-center gap-3 px-4 py-2.5 text-inherit no-underline";
          return (
            <li key={row.id}>
              {row.href ? (
                <Link
                  href={row.href}
                  className={cn(rowClass, "hover:bg-raise")}
                  onClick={() => (row.unread ? mark.execute({ ids: [row.id] }) : undefined)}
                >
                  {content}
                </Link>
              ) : (
                <div className={rowClass}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
