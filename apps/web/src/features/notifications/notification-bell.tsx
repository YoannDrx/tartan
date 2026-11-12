"use client";

import { m } from "@tartan/i18n";
import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export const NotificationBell = () => {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const refresh = async () => {
      const res = await fetch("/api/v1/notifications?limit=1").catch(() => null);
      if (!res?.ok) return;
      setUnread(((await res.json()) as { unread: number }).unread);
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [pathname]);
  const active = pathname === "/notifications";
  return (
    <Link
      href="/notifications"
      aria-label={m.inbox.open(unread)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-raise",
        active ? "bg-accent text-on-accent" : "text-fg",
      )}
    >
      <Bell aria-hidden className="size-5" />
      {unread > 0 ? (
        <span
          aria-hidden
          className="t-num absolute right-0 top-0 flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[12px] leading-[18px] text-on-accent"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
};
