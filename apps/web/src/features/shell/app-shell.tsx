"use client";

import {
  CalendarDays,
  ChartNoAxesColumn,
  Dumbbell,
  House,
  Megaphone,
  Sparkles,
  TrendingUp,
  UsersRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import type { ReleaseView, SpaceSummary } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { Logo } from "@/components/logo";
import { Select } from "@/components/ui/field";
import { RouteTransition } from "@/components/ui/route-transition";
import { ACTIVE_TAB } from "@/components/ui/view-transition";
import { cn } from "@/lib/cn";
import { worldFor } from "@/lib/world";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { UpdateWatcher } from "./update-watcher";
import { InstallBanner } from "./install-banner";
import { SatisfactionQuestion } from "./satisfaction";
import { SettingsMenu } from "./settings-menu";
import { switchSpaceAction } from "./shell.action";

type Item = { href: string; label: string; icon: LucideIcon; mobile: boolean };

const coachItems: Item[] = [
  { href: "/suivi", label: m.nav.suivi, icon: ChartNoAxesColumn, mobile: true },
  { href: "/calendrier", label: m.nav.calendrier, icon: CalendarDays, mobile: true },
  { href: "/exercices", label: m.nav.exercices, icon: Dumbbell, mobile: true },
  { href: "/athletes", label: m.nav.athletes, icon: UsersRound, mobile: false },
  { href: "/videos", label: m.nav.videos, icon: Video, mobile: true },
  { href: "/annonces", label: m.nav.annonces, icon: Megaphone, mobile: true },
];

const athleteItems: Item[] = [
  { href: "/aujourdhui", label: m.nav.aujourdhui, icon: House, mobile: true },
  { href: "/calendrier", label: m.nav.calendrier, icon: CalendarDays, mobile: true },
  { href: "/progres", label: m.nav.progres, icon: TrendingUp, mobile: true },
  { href: "/mes-sauts", label: m.nav.mesSauts, icon: Video, mobile: true },
  { href: "/annonces", label: m.nav.annonces, icon: Megaphone, mobile: true },
];

const SpaceSwitcher = ({ spaces, current }: { spaces: SpaceSummary[]; current: SpaceSummary }) => {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Un seul espace : sur téléphone, son nom tronqué n'apprend rien. Il est dans le menu des réglages.
  if (spaces.length < 2) {
    return <span className="hidden truncate text-[14px] text-fg-muted tablet:inline">{current.organizationName}</span>;
  }
  return (
    <label className="block w-40 min-w-0 text-[14px] tablet:w-56">
      <span className="sr-only">{m.settings.switchSpace}</span>
      <Select
        disabled={pending}
        className="truncate text-[14px]"
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
      </Select>
    </label>
  );
};

export const AppShell = ({
  staff,
  spaces,
  space,
  account,
  admin,
  askSatisfaction = false,
  unseenRelease = null,
  billingAlert = null,
  children,
}: {
  staff: boolean;
  spaces: SpaceSummary[];
  space: SpaceSummary;
  account: { name: string | null; email: string };
  admin: boolean;
  askSatisfaction?: boolean;
  unseenRelease?: ReleaseView | null;
  billingAlert?: "past_due" | null;
  children: ReactNode;
}) => {
  const pathname = usePathname();
  const work = worldFor(pathname) === "world-work";
  const selectedClass = "bg-accent text-on-accent";
  const barClass = work ? "tartan-band" : "on-card bg-card";
  const plannerItem: Item = { href: "/planificateur", label: m.nav.planificateur, icon: Sparkles, mobile: false };
  const items = staff
    ? space.aiPlannerEnabled || space.aiPlannerUpgrade
      ? [...coachItems.slice(0, 2), plannerItem, ...coachItems.slice(2)]
      : coachItems
    : athleteItems;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // Le mode séance et l'analyse vidéo prennent tout l'écran, en sombre.
  const immersive = /^\/(seance\/[^/]+\/mode|videos\/[^/]+|mes-sauts\/[^/]+)/.test(pathname);
  if (immersive) return <div className="overflow-x-clip">{children}</div>;

  return (
    <div className={cn(worldFor(pathname), "min-h-dvh overflow-x-clip pb-[76px] desktop:pb-0")}>
      <header className={cn("app-header sticky z-30", barClass)}>
        <div className="mx-auto flex min-h-14 max-w-[1440px] items-center gap-4 px-4 desktop:px-6">
          <Link href="/accueil" aria-label="Tartan, accueil" className="inline-flex min-h-11 shrink-0 items-center">
            <Logo height={28} onDark />
          </Link>
          <nav aria-label="Navigation principale" className="hidden flex-1 items-center gap-1 desktop:flex">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full px-3.5 font-medium no-underline transition-colors",
                  isActive(item.href) ? `${selectedClass} ${ACTIVE_TAB} font-semibold` : "text-fg hover:bg-raise",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <SpaceSwitcher spaces={spaces} current={space} />
            {/* Les rubriques hors de la barre d'onglets (§ 10.3) restent à portée de doigt. */}
            {items
              .filter((item) => !item.mobile)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-raise desktop:hidden",
                      isActive(item.href) ? `${selectedClass} ${ACTIVE_TAB}` : "text-fg",
                    )}
                  >
                    <Icon aria-hidden className="size-5" />
                  </Link>
                );
              })}
            <NotificationBell />
            <SettingsMenu account={account} space={space} active={isActive("/reglages")} admin={admin} staff={staff} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pb-8 pt-5 desktop:px-6 desktop:pt-8">
        {/* Un paiement à régulariser passe devant : sans lui, l'espace retombe en offre gratuite. */}
        {billingAlert && !isActive("/abonnement") ? (
          <p
            role="status"
            className="on-card flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-card bg-card px-4 py-3"
          >
            <span>{m.billing.pastDueBanner}</span>
            <Link
              href="/abonnement"
              className="flex min-h-11 items-center font-semibold text-ctx-link underline underline-offset-4"
            >
              {m.billing.pastDueAction}
            </Link>
          </p>
        ) : null}
        {/* Le contenu d'abord, l'athlète vient pour sa séance : les autres bandeaux passent dessous. */}
        <RouteTransition>{children}</RouteTransition>
        <UpdateWatcher unseen={unseenRelease} />
        <InstallBanner />
        {askSatisfaction ? <SatisfactionQuestion /> : null}
      </main>

      <nav
        aria-label="Navigation principale"
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 flex justify-around gap-1 px-1 pb-[env(safe-area-inset-bottom)] pt-1 desktop:hidden",
          barClass,
        )}
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
                  "my-1 flex min-h-[60px] min-w-[60px] flex-1 flex-col items-center justify-center gap-1 rounded-button text-[12px] leading-none no-underline",
                  active
                    ? `${selectedClass} ${ACTIVE_TAB} font-semibold`
                    : work
                      ? "font-medium text-fg"
                      : "font-medium text-fg-muted",
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
