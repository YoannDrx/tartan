import type { OrgRole } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Sheet } from "@/components/sheet";
import { RUBRIC_ICON, rubricTitle } from "./rubric-meta";
import { rubricPath, settingsGroups, type SettingsRubric } from "./sections";

export type RubricSummaries = Record<SettingsRubric, string>;

// Le sommaire des réglages, sur téléphone : une feuille par famille, une ligne par rubrique, avec ce qu'elle
// contient aujourd'hui (le nom, le nombre de groupes, le thème choisi). Sur ordinateur, la barre latérale le remplace.
export const SettingsIndex = ({
  role,
  spaceName,
  summaries,
}: {
  role: OrgRole;
  spaceName: string;
  summaries: RubricSummaries;
}) => (
  <nav aria-label={m.settings.sectionsNav} className="flex flex-col gap-5 desktop:hidden">
    {settingsGroups(role).map((group) => {
      const label = group.id === "compte" ? w.settings.account : group.id === "espace" ? spaceName : null;
      return (
        <div key={group.id ?? "tout"} className="flex flex-col gap-2">
          {label ? <h2 className="t-section break-words">{label}</h2> : null}
          <Sheet>
            <ul className="divide-y divide-card-line">
              {group.rubrics.map((rubric) => {
                const Icon = RUBRIC_ICON[rubric];
                return (
                  <li key={rubric}>
                    <Link
                      href={rubricPath(rubric)}
                      className="flex min-h-16 items-center gap-3.5 px-4 py-2.5 text-inherit no-underline hover:bg-card-raised"
                    >
                      <Icon aria-hidden className="size-[22px] shrink-0" />
                      <span className="min-w-0 flex-1 leading-snug">
                        <span className="block font-semibold">{rubricTitle(rubric)}</span>
                        <span className="block truncate text-[15px] text-soft">{summaries[rubric]}</span>
                      </span>
                      <ChevronRight aria-hidden className="size-5 shrink-0 text-soft" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Sheet>
        </div>
      );
    })}
  </nav>
);
