import Link from "next/link";
import { notFound } from "next/navigation";
import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { requireStaffSpace } from "@/features/shell/space";
import { StrengthMappings } from "@/features/settings/strength-mappings";
import { listExercises } from "@/server/exercise.service";
import { strengthMappingReport } from "@/server/strength.service";

export default async function StrengthMappingsPage() {
  const { actor, organizationId, space } = await requireStaffSpace();
  if (space.role !== "owner") notFound();
  const [report, exercises] = space.progressionEnabled
    ? await Promise.all([
        strengthMappingReport(actor.userId, organizationId),
        listExercises(actor.userId, organizationId),
      ])
    : [null, []];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader
        title={m.strengthMapping.title}
        before={
          <Link href="/reglages" className="inline-flex min-h-11 items-center font-semibold">
            {m.common.back}
          </Link>
        }
      />
      {report ? (
        <StrengthMappings
          key={organizationId}
          initialReport={report}
          exercises={exercises}
          organizationId={organizationId}
        />
      ) : (
        <p>{m.progression.disabled}</p>
      )}
    </div>
  );
}
