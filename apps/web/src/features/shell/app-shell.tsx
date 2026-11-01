"use client";

import {
  CalendarDays,
  ChartNoAxesColumn,
  Dumbbell,
  House,
  Megaphone,
  Settings,
  TrendingUp,
  UsersRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import type { SpaceSummary } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/cn";
import { switchSpaceAction } from "./shell.action";

type Item = { href: string; label: string; icon: LucideIcon; mobile: boolean };

const coachItems: Item[] = [
  { href: "/suivi", label: m.nav.suivi, icon: ChartNoAxesColumn, mobile: true },
  { href: "/calendrier", label: m.nav.calendrier, icon: CalendarDays, mobile: true },
  { href: "/exercices", label: m.nav.exercices, icon: Dumbbell, mobile: true },
  { href: "/athletes", label: m.nav.athletes, icon: UsersRound, mobile: false },
  { href: "/videos", label: m.nav.videos, icon: Video, mobile: true },
  { href: "/annonces", label: m.nav.annonces, icon: Megaphone, mobile: true },
  { href: "/reglages", label: m.nav.reglages, icon: Settings, mobile: false },
];

const athleteItems: Item[] = [
  { href: "/aujourdhui", label: m.nav.aujourdhui, icon: House, mobile: true },
  { href: "/calendrier", label: m.nav.calendrier, icon: CalendarDays, mobile: true },
  { href: "/progres", label: m.nav.progres, icon: TrendingUp, mobile: true },
  { href: "/mes-sauts", label: m.nav.mesSauts, icon: Video, mobile: true },
  { href: "/annonces", label: m.nav.annonces, icon: Megaphone, mobile: true },
  { href: "/reglages", label: m.nav.reglages, icon: Settings, mobile: false },
];

const SpaceSwitcher = ({ spaces, current }: { spaces: SpaceSummary[]; current: SpaceSummary }) => {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (spaces.length < 2) {
    return <span className="truncate text-[14px] text-muted">{current.organizationName}</span>;
  }
  return (
    <label className="flex items-center gap-2 text-[14px]">
      <span className="sr-only">{m.settings.switchSpace}</span>
      <select
        disabled={pending}
        className="min-h-11 max-w-56 rounded-[10px] border border-border bg-surface px-2"
        value={current.organizationId}
        onChange={(e) =>
          start(async () => {
            await switchSpaceAction({ organizationId: e.target.value });
            router.push("/accueil");
            router.refresh();
          })
        }
      >
        {spaces.map((s) => (
          <option key={s.organizationId} value={s.organizationId}>
            {s.organizationName} ({m.roles[s.role]})
          </option>
        ))}
      </select>
    </label>
  );
};

export const AppShell = ({
  staff,
  spaces,
  space,
  children,
}: {
  staff: boolean;
  spaces: SpaceSummary[];
  space: SpaceSummary;
  children: ReactNode;
}) => {
  const pathname = usePathname();
  const items = staff ? coachItems : athleteItems;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // Le mode séance et l'analyse vidéo prennent tout l'écran, en sombre.
  const immersive = /^\/(seance\/[^/]+\/mode|videos\/[^/]+|mes-sauts\/[^/]+)/.test(pathname);
  if (immersive) return <>{children}</>;

  return (
    <div className="min-h-dvh pb-[76px] desktop:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex min-h-14 max-w-[1440px] items-center gap-4 px-4 desktop:px-6">
          <Link href="/accueil" aria-label="Tartan, accueil" className="inline-flex shrink-0 items-center">
            <Logo height={28} />
          </Link>
          <nav aria-label="Navigation principale" className="hidden flex-1 items-center gap-1 desktop:flex">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-button px-3 font-medium no-underline hover:bg-bg",
                  isActive(item.href) ? "font-semibold text-brand-strong" : "text-ink",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <SpaceSwitcher spaces={spaces} current={space} />
            <Link
              href="/reglages"
              aria-label={m.nav.reglages}
              className="inline-flex size-11 items-center justify-center rounded-button text-ink hover:bg-bg desktop:hidden"
            >
              <Settings aria-hidden className="size-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 desktop:px-6">{children}</main>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] desktop:hidden"
      >
        {items
          .filter((item) => item.mobile)
          .map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[68px] min-w-[60px] flex-1 flex-col items-center justify-center gap-1 text-[11px] leading-none no-underline",
                  active ? "font-semibold text-brand-strong" : "font-medium text-muted",
                )}
              >
                <Icon aria-hidden className="size-6" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
      </nav>
    </div>
  );
};
