"use client";

import type { OrgRole } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, type ReactNode } from "react";
import { PageHeader } from "@/components/states";
import { ACTIVE_TAB } from "@/components/ui/view-transition";
import { cn } from "@/lib/cn";
import { RUBRIC_ICON, rubricTitle } from "./rubric-meta";
import {
  FIRST_RUBRIC,
  SETTINGS_ROOT,
  rubricOfPath,
  rubricPath,
  settingsGroups,
  type SettingsGroupId,
  type SettingsRubric,
} from "./sections";

// `current` : "page" quand la rubrique est la page ouverte, "true" quand le sommaire la montre à sa place.
const RubricLink = ({ rubric, current }: { rubric: SettingsRubric; current: "page" | "true" | undefined }) => {
  const Icon = RUBRIC_ICON[rubric];
  return (
    <Link
      href={rubricPath(rubric)}
      aria-current={current}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-full px-3.5 no-underline",
        // La rubrique courante se lit sans la couleur : graisse, pastille pleine et chevron.
        current ? `bg-accent font-semibold text-on-accent ${ACTIVE_TAB}` : "font-medium text-inherit hover:bg-raise",
      )}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{rubricTitle(rubric)}</span>
      {current ? <ChevronRight aria-hidden className="size-4 shrink-0" /> : null}
    </Link>
  );
};

const RubricGroup = ({
  id,
  rubrics,
  current,
  opened,
  spaceName,
}: {
  id: SettingsGroupId | null;
  rubrics: SettingsRubric[];
  current: SettingsRubric;
  opened: boolean;
  spaceName: string;
}) => {
  const labelId = useId();
  const label = id === "compte" ? w.settings.account : id === "espace" ? spaceName : null;
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <p id={labelId} className="t-caption truncate px-3.5 font-semibold">
          {label}
        </p>
      ) : null}
      <ul aria-labelledby={label ? labelId : undefined} className="flex flex-col">
        {rubrics.map((rubric) => (
          <li key={rubric}>
            <RubricLink rubric={rubric} current={rubric === current ? (opened ? "page" : "true") : undefined} />
          </li>
        ))}
      </ul>
    </div>
  );
};

// L'ossature des réglages. Sur téléphone, le sommaire puis une rubrique par page, avec un retour vers le sommaire.
// Sur ordinateur, la barre latérale des rubriques à gauche et la rubrique à droite ; le sommaire y montre la première.
export const SettingsFrame = ({
  role,
  spaceName,
  children,
}: {
  role: OrgRole;
  spaceName: string;
  children: ReactNode;
}) => {
  const pathname = usePathname();
  const opened = rubricOfPath(pathname);
  const current = opened ?? FIRST_RUBRIC;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={m.settings.title}
        narrowTitle={opened ? rubricTitle(opened) : undefined}
        detail={`${spaceName}, ${m.roles[role].toLowerCase()}`}
        before={
          opened ? (
            <Link
              href={SETTINGS_ROOT}
              className="-ml-1.5 inline-flex min-h-11 items-center gap-1 self-start pr-2 font-semibold no-underline desktop:hidden"
            >
              <ChevronLeft aria-hidden className="size-5" />
              {m.settings.title}
            </Link>
          ) : null
        }
      />
      <div className="grid items-start gap-4 desktop:grid-cols-[232px_minmax(0,800px)] desktop:gap-8">
        <nav
          aria-label={m.settings.sectionsNav}
          className="hidden flex-col gap-5 desktop:sticky desktop:top-20 desktop:flex"
        >
          {settingsGroups(role).map((group) => (
            <RubricGroup
              key={group.id ?? "tout"}
              {...group}
              current={current}
              opened={opened !== null}
              spaceName={spaceName}
            />
          ))}
        </nav>
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </div>
    </div>
  );
};
