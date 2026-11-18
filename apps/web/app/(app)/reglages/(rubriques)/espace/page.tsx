import { trainingProfileSchema } from "@tartan/contracts";
import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Rows, Sheet, SheetSection } from "@/components/sheet";
import { LogoForm, OrganizationForm } from "@/features/settings/espace/organization-forms";
import { ReportList } from "@/features/settings/espace/reports";
import { requireRubric } from "@/features/settings/rubric-access";
import { LinkRow } from "@/features/settings/setting-rows";
import { env } from "@/lib/env";
import { listReports } from "@/server/comm.service";
import { getOrganization } from "@/server/org.service";

export const metadata: Metadata = { title: w.settings.rubrics.espace.title };

export default async function EspacePage() {
  const { actor, organizationId, space } = await requireRubric("espace");
  const [organization, reports] = await Promise.all([
    getOrganization(actor.userId, organizationId),
    listReports(actor.userId, organizationId),
  ]);
  const t = w.settings.espace;
  return (
    <Sheet className="divide-y divide-card-line">
      <SheetSection id="espace" title={t.section}>
        <div className="flex flex-col gap-4">
          {env().BLOB_READ_WRITE_TOKEN ? <LogoForm logoUrl={organization.logoUrl} name={organization.name} /> : null}
          <OrganizationForm
            name={organization.name}
            overdueReminders={organization.overdueReminders}
            {...trainingProfileSchema.parse(organization)}
          />
        </div>
      </SheetSection>
      {space.role === "owner" && space.progressionEnabled ? (
        <SheetSection id="references-force" title={t.strength}>
          <Rows>
            <LinkRow href="/reglages/references-force" title={m.strengthMapping.title} detail={t.strengthDetail} />
          </Rows>
        </SheetSection>
      ) : null}
      <SheetSection id="signalements" title={m.settings.reports}>
        <ReportList reports={reports} />
      </SheetSection>
    </Sheet>
  );
}
