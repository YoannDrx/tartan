import { can } from "@tartan/domain";
import type { Metadata } from "next";
import { w } from "@tartan/i18n/web";
import { Rows, Sheet, SheetSection } from "@/components/sheet";
import { GroupRow, NewGroupForm } from "@/features/settings/groupes/groups";
import { requireRubric } from "@/features/settings/rubric-access";
import { listGroups } from "@/server/org.service";

export const metadata: Metadata = { title: w.settings.rubrics.groupes.title };

export default async function GroupesPage() {
  const { access } = await requireRubric("groupes");
  const groups = await listGroups(access);
  const t = w.settings.groupes;
  return (
    <Sheet>
      <SheetSection id="groupes" title={t.section}>
        <div className="flex flex-col gap-3">
          <p className="max-w-prose">{t.detail}</p>
          {groups.length > 0 ? (
            <Rows className="border-t border-card-line">
              {groups.map((group) => (
                <GroupRow key={group.id} group={group} canDelete={can(access.role, "manageOrganization")} />
              ))}
            </Rows>
          ) : null}
          <NewGroupForm />
        </div>
      </SheetSection>
    </Sheet>
  );
}
