"use client";

import {
  CalendarDays,
  ChartNoAxesColumn,
  Dumbbell,
  House,
  Megaphone,
  Sparkles,
  SquarePen,
  TrendingUp,
  UsersRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { type ReactNode } from "react";
import type { ReleaseView, SpaceSummary } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Logo, LogoMark } from "@/components/logo";
import { selectableSpaces } from "@tartan/domain";
import { chooseHomeAction } from "./shell.action";
import { useAction } from "next-safe-action/hooks";
import { onErr } from "@/features/settings/shared";
import { ACTIVE_TAB } from "@/components/ui/view-transition";
import { cn } from "@/lib/cn";
import { worldFor } from "@/lib/world";
import { DemoSpaceBanner } from "@/features/demo-space/demo-space-banner";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { UpdateWatcher } from "./update-watcher";
import { InstallBanner } from "./install-banner";
import { SatisfactionQuestion } from "./satisfaction";
import { SettingsMenu, type Account } from "./settings-menu";

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
  { href: "/mes-videos", label: m.nav.videos, icon: Video, mobile: true },
  { href: "/exercices", label: m.nav.exercices, icon: Dumbbell, mobile: true },
  { href: "/annonces", label: m.nav.annonces, icon: Megaphone, mobile: false },
];

// L'athlète autonome, dans son espace personnel : ses rubriques d'athlète, la bibliothèque, et « Planifier », qui ouvre
// le constructeur sans destinataires. Ni suivi de groupe, ni athlètes, ni annonces.
const personalItems: Item[] = [
  { href: "/aujourdhui", label: m.nav.aujourdhui, icon: House, mobile: true },
  { href: "/calendrier", label: m.nav.calendrier, icon: CalendarDays, mobile: true },
  { href: "/exercices", label: m.nav.exercices, icon: Dumbbell, mobile: true },
  { href: "/progres", label: m.nav.progres, icon: TrendingUp, mobile: true },
  { href: "/mes-videos", label: m.nav.videos, icon: Video, mobile: true },
  { href: "/seances/nouvelle", label: w.personal.nav.plan, icon: SquarePen, mobile: false },
];

export const AppShell = ({
  staff,
  space,
  spaces,
  account,
  admin,
  askSatisfaction = false,
  unseenRelease = null,
  billingAlert = null,
  children,
}: {
  staff: boolean;
  space: SpaceSummary;
  spaces: SpaceSummary[];
  account: Account;
  admin: boolean;
  askSatisfaction?: boolean;
  unseenRelease?: ReleaseView | null;
  billingAlert?: "past_due" | null;
  children: ReactNode;
}) => {
  const choices = selectableSpaces(spaces);
  const router = useRouter();
  const choose = useAction(chooseHomeAction, { onError: onErr, onSuccess: () => router.replace("/accueil") });
  const pathname = usePathname().replace(/^\/(carnet|club)(?=\/)/, "");
  const work = worldFor(pathname) === "world-work";
  const selectedClass = "bg-accent text-on-accent";
  const barClass = work ? "tartan-band" : "on-card bg-card";
  const plannerItem: Item = { href: "/planificateur", label: m.nav.planificateur, icon: Sparkles, mobile: false };
  const items = staff
    ? space.aiPlannerEnabled || space.aiPlannerUpgrade
      ? [...coachItems.slice(0, 2), plannerItem, ...coachItems.slice(2)]
      : coachItems
    : space.kind === "personal"
      ? space.aiPlannerEnabled
        ? [...personalItems, plannerItem]
        : personalItems
      : athleteItems;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // Le mode séance et l'analyse vidéo prennent tout l'écran, en sombre.
  const immersive = /^\/(seance\/[^/]+\/mode|videos\/[^/]+|mes-videos\/[^/]+)/.test(pathname);
  if (immersive) return <div className="overflow-x-clip">{children}</div>;

  return (
    <div className={cn(worldFor(pathname), "min-h-dvh overflow-x-clip pb-[76px] desktop:pb-0")}>
      <header className={cn("app-header sticky z-30", barClass)}>
        <div className="mx-auto flex min-h-14 max-w-[1440px] flex-wrap items-center gap-x-2 px-4 tablet:flex-nowrap tablet:gap-4 desktop:px-6">
          {/* Sur téléphone, l'icône seule : la place revient au nom de l'espace (audit G6). */}
          <Link href="/accueil" className="flex min-h-11 min-w-24 items-center gap-2">
            <span className="tablet:hidden">
              <LogoMark size={32} />
              <span className="sr-only">{m.brand.name} </span>
            </span>
            <span className="max-tablet:hidden">
              <Logo height={28} onDark />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <strong>{staff ? m.roles.coach : m.roles.athlete}</strong>{" "}
              <span hidden={choices.length > 1} data-testid="space-name" className="max-w-32 truncate text-[13px]">
                {space.organizationName}
              </span>
            </span>
          </Link>
          {choices.length > 1 && (
            <select
              aria-label={m.settings.switchSpace}
              value={space.organizationId}
              disabled={choose.isPending}
              onChange={(event) => choose.execute({ organizationId: event.target.value })}
              className="order-last mb-1 min-h-11 w-full min-w-0 truncate rounded-control tablet:order-none tablet:mb-0 tablet:w-auto bg-card px-2 text-card-fg tablet:max-w-52"
            >
              {!choices.some((s) => s.organizationId === space.organizationId) && (
                <option value={space.organizationId}>{space.organizationName}</option>
              )}
              {choices.map((s) => (
                <option key={s.organizationId} value={s.organizationId}>
                  {s.organizationName} ({m.roles[s.role]})
                </option>
              ))}
            </select>
          )}
          <nav aria-label={w.shell.mainNav} className="hidden flex-1 items-center gap-1 desktop:flex">
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
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 tablet:flex-initial tablet:gap-2">
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
        {/* Dans la démonstration, le bandeau passe devant tout : on sait où l'on est et comment en sortir. */}
        {space.isDemo ? <DemoSpaceBanner expiresAt={space.demoExpiresAt ?? null} /> : null}
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
        {children}
        <UpdateWatcher unseen={unseenRelease} />
        <InstallBanner />
        {askSatisfaction && !space.isDemo ? <SatisfactionQuestion /> : null}
      </main>

      <nav
        aria-label={w.shell.mainNav}
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
