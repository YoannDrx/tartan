"use client";

import type { SpaceSummary } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { CircleHelp, Flag, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { ScreenHelpDialog } from "@/features/help/screen-help-dialog";
import { rubricTitle } from "@/features/settings/rubric-meta";
import { SETTINGS_ROOT, canOpenRubric, rubricPath, type SettingsRubric } from "@/features/settings/sections";
import { cn } from "@/lib/cn";
import { FIRST_STEPS_PATH } from "@/lib/onboarding-paths";
import { signOut } from "./sign-out";

const itemClass =
  "flex min-h-11 cursor-pointer items-center rounded-[8px] px-3 text-fg no-underline outline-none data-[highlighted]:bg-raise";

export type Account = {
  name: string | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  avatarPreset?: string | null;
};

export const SettingsMenu = ({
  account,
  space,
  active,
  admin,
  staff,
}: {
  account: Account;
  space: SpaceSummary;
  active: boolean;
  admin: boolean;
  staff: boolean;
}) => {
  const [leaving, setLeaving] = useState(false);
  const person = { ...account, name: account.name ?? account.email };
  const [help, setHelp] = useState(false);
  // Les raccourcis portent le nom des rubriques des réglages et y mènent ; l'abonnement ouvre l'offre complète.
  const shortcuts: SettingsRubric[] =
    space.role === "athlete" ? ["profil", "confidentialite"] : ["profil", "espace", "groupes", "abonnement"];
  const links = [
    ...shortcuts
      .filter((rubric) => canOpenRubric(space.role, rubric))
      .map((rubric) => ({
        href: rubric === "abonnement" ? "/abonnement" : rubricPath(rubric),
        label: rubricTitle(rubric),
      })),
    ...(admin ? [{ href: "/admin", label: m.admin.title }] : []),
  ];

  return (
    <>
      <DropdownMenu.Root modal={false}>
        {/* Le compte et les réglages : l'avatar de la personne, marqué d'un engrenage pour dire ce qu'il ouvre. */}
        <DropdownMenu.Trigger
          aria-label={m.nav.reglages}
          data-testid="account-menu"
          className={cn(
            "relative inline-flex size-12 shrink-0 items-center justify-center rounded-full data-[state=open]:bg-raise",
            active ? "bg-accent text-on-accent" : "text-fg hover:bg-raise",
          )}
        >
          <Avatar person={person} size="header" />
          <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-card text-fg shadow-float">
            <Settings aria-hidden className="size-3" />
          </span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            collisionPadding={8}
            className="menu-enter on-card z-50 w-[272px] max-w-[calc(100vw-16px)] rounded-card border border-card-line bg-card p-1.5 shadow-float-strong"
          >
            <div className="flex items-center gap-3 px-3 pb-2 pt-1.5 leading-snug">
              <Avatar person={person} size="md" />
              <div className="min-w-0">
                {account.name ? <p className="truncate font-semibold">{account.name}</p> : null}
                <p className="t-caption truncate font-normal text-soft">{account.email}</p>
                <p className="t-caption mt-1 truncate font-normal text-soft">{space.organizationName}</p>
              </div>
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-card-line" />
            {links.map((link) => (
              <DropdownMenu.Item key={link.href} asChild className={itemClass}>
                <Link href={link.href}>{link.label}</Link>
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Item asChild className={itemClass}>
              <Link href={SETTINGS_ROOT}>{m.nav.allSettings}</Link>
            </DropdownMenu.Item>
            {/* Les premiers pas restent à portée après le tour : la carte refermée se retrouve ici. */}
            {staff ? (
              <DropdownMenu.Item asChild className={cn(itemClass, "gap-2")}>
                <Link href={FIRST_STEPS_PATH}>
                  <Flag aria-hidden className="size-4" />
                  {w.onboarding.menu}
                </Link>
              </DropdownMenu.Item>
            ) : null}
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
