"use client";

import type { SpaceSummary } from "@tartan/contracts";
import { can } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { CircleHelp, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { ScreenHelpDialog } from "@/features/help/screen-help-dialog";
import { cn } from "@/lib/cn";
import { signOut } from "./sign-out";

const itemClass =
  "flex min-h-11 cursor-pointer items-center rounded-[8px] px-3 text-fg no-underline outline-none data-[highlighted]:bg-raise";

export const SettingsMenu = ({
  account,
  space,
  active,
  admin,
  staff,
}: {
  account: { name: string | null; email: string };
  space: SpaceSummary;
  active: boolean;
  admin: boolean;
  staff: boolean;
}) => {
  const [leaving, setLeaving] = useState(false);
  const [help, setHelp] = useState(false);
  const links = [
    { href: "/reglages#profil", label: m.settings.profile, show: true },
    { href: "/reglages#espace", label: m.settings.organization, show: can(space.role, "manageOrganization") },
    { href: "/reglages#invitations", label: m.settings.groups, show: can(space.role, "inviteAthlete") },
    { href: "/abonnement", label: m.settings.plan, show: can(space.role, "manageSubscription") },
    { href: "/reglages#confidentialite", label: m.settings.privacy, show: space.role === "athlete" },
    { href: "/admin", label: m.admin.title, show: admin },
  ].filter((link) => link.show);

  return (
    <>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger
          aria-label={m.nav.reglages}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-full data-[state=open]:bg-raise",
            active ? "bg-accent text-on-accent" : "text-fg hover:bg-raise",
          )}
        >
          <Settings aria-hidden className="size-5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            collisionPadding={8}
            className="menu-enter on-card z-50 w-[272px] max-w-[calc(100vw-16px)] rounded-card border border-card-line bg-card p-1.5 shadow-float-strong"
          >
            <div className="px-3 pb-2 pt-1.5 leading-snug">
              {account.name ? <p className="truncate font-semibold">{account.name}</p> : null}
              <p className="t-caption truncate font-normal text-soft">{account.email}</p>
              <p className="t-caption mt-1 truncate font-normal text-soft">{space.organizationName}</p>
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-card-line" />
            {links.map((link) => (
              <DropdownMenu.Item key={link.href} asChild className={itemClass}>
                <Link href={link.href}>{link.label}</Link>
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Item asChild className={itemClass}>
              <Link href="/reglages">{m.nav.allSettings}</Link>
            </DropdownMenu.Item>
            {/* L'aide garde la même place sur tous les écrans, pour le coach comme pour l'athlète. */}
            <DropdownMenu.Item className={cn(itemClass, "gap-2")} onSelect={() => setHelp(true)}>
              <CircleHelp aria-hidden className="size-4" />
              {m.help.screen.open}
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-card-line" />
            <DropdownMenu.Item
              disabled={leaving}
              className={cn(itemClass, "gap-2 font-semibold data-[disabled]:opacity-60")}
              onSelect={(event) => {
                event.preventDefault();
                setLeaving(true);
                void signOut().catch(() => setLeaving(false));
              }}
            >
              <LogOut aria-hidden className="size-4" />
              {m.common.signOut}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ScreenHelpDialog open={help} onOpenChange={setHelp} staff={staff} />
    </>
  );
};
