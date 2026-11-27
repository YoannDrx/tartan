"use client";

import type { SpaceSummary } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { LogoMark, RoleWordmark, Wordmark } from "@/components/logo";
import { onErr } from "@/features/settings/shared";
import { cn } from "@/lib/cn";
import { chooseHomeAction } from "./shell.action";

const isStaff = (space: SpaceSummary) => space.role !== "athlete" && space.role !== "guardian";
const homeOf = (space: SpaceSummary) => (isStaff(space) ? "/suivi" : "/aujourdhui");
const spaceName = (space: SpaceSummary) => space.organizationName;

// « Tartan Coach » ou « Tartan Athlète » : la marque, puis le rôle écrit dans la même police, l'initiale en couloirs.
// Sur téléphone, la marque seule tient lieu de T.
const Lockup = ({ staff }: { staff: boolean }) => (
  <span className="flex items-center gap-1.5">
    <span className="flex tablet:hidden">
      <LogoMark size={28} />
      <span className="sr-only">{m.brand.name} </span>
    </span>
    {/* L'enveloppe porte le masquage : `.wordmark` (globals.css, hors couche) imposerait son affichage. */}
    <span className="flex max-tablet:hidden">
      <Wordmark className="text-inherit" />
    </span>{" "}
    <RoleWordmark
      role={staff ? "coach" : "athlete"}
      label={staff ? m.roles.coach : m.roles.athlete}
      className="text-inherit"
    />{" "}
  </span>
);

// L'initiale du club, sur une pastille de la couleur de son rôle : on reconnaît l'espace avant d'en lire le nom.
const SpaceBadge = ({ space }: { space: SpaceSummary }) => (
  <span
    aria-hidden
    className={cn(
      "flex size-10 shrink-0 items-center justify-center rounded-[10px] text-[17px] font-bold",
      isStaff(space) ? "bg-accent text-on-accent" : "bg-raise text-fg",
    )}
  >
    {(spaceName(space).trim() || m.brand.name).charAt(0).toLocaleUpperCase("fr")}
  </span>
);

// La marque de l'en-tête. Un seul espace : elle mène à l'accueil. Plusieurs : elle ouvre la liste des espaces, une
// carte par espace (initiale, nom, rôle, coche), et le choix mène droit à l'accueil du rôle, sans redirection.
export const SpaceSwitcher = ({
  space,
  spaces,
  staff,
}: {
  space: SpaceSummary;
  spaces: SpaceSummary[];
  staff: boolean;
}) => {
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);
  const choose = useAction(chooseHomeAction, {
    onError: (args) => {
      setOpening(null);
      onErr(args);
    },
    onSuccess: ({ input }) => {
      const target = spaces.find((s) => s.organizationId === input.organizationId);
      if (target) router.replace(homeOf(target));
    },
  });
  const choices = spaces.some((s) => s.organizationId === space.organizationId) ? spaces : [space, ...spaces];
  const club = (
    <span data-testid="space-name" className="t-caption block max-w-40 truncate font-medium text-soft tablet:max-w-56">
      {spaceName(space)}
    </span>
  );

  if (spaces.length < 2) {
    return (
      <Link href={staff ? "/suivi" : "/aujourdhui"} className="flex min-h-11 min-w-0 flex-col justify-center gap-0.5">
        <Lockup staff={staff} />
        {club}
      </Link>
    );
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        data-feedback="select"
        disabled={choose.isPending}
        className="group -mx-2 flex min-h-11 min-w-0 flex-col justify-center gap-0.5 rounded-button px-2 py-1 text-left hover:bg-raise data-[state=open]:bg-raise disabled:opacity-70"
      >
        <Lockup staff={staff} />
        <span className="flex min-w-0 items-center gap-1">
          {club}
          <ChevronDown
            aria-hidden
            className="size-3.5 shrink-0 text-soft transition-transform duration-(--duration-instant) group-data-[state=open]:rotate-180 motion-reduce:transition-none"
          />
          <span className="sr-only">, {m.settings.switchSpace}</span>
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="menu-enter on-card z-50 w-[304px] max-w-[calc(100vw-16px)] rounded-card border border-card-line bg-card p-1.5 shadow-float-strong"
        >
          <DropdownMenu.Label className="t-caption px-3 pb-1 pt-1.5 font-semibold text-soft">
            {w.shell.spaces.title}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={space.organizationId}
            onValueChange={(organizationId) => {
              if (organizationId === space.organizationId || choose.isPending) return;
              setOpening(organizationId);
              choose.execute({ organizationId });
            }}
          >
            {choices.map((s) => {
              const pending = opening === s.organizationId && choose.isPending;
              return (
                <DropdownMenu.RadioItem
                  key={s.organizationId}
                  value={s.organizationId}
                  data-feedback="select"
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[10px] px-2 py-1.5 outline-none data-[highlighted]:bg-raise"
                >
                  <SpaceBadge space={s} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{spaceName(s)}</span>
                    <span className="t-caption block text-soft">
                      {pending ? w.shell.spaces.opening : m.roles[isStaff(s) ? "coach" : "athlete"]}
                    </span>
                  </span>
                  <DropdownMenu.ItemIndicator>
                    <Check aria-label={w.shell.spaces.current} className="size-5 text-fg" />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              );
            })}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
