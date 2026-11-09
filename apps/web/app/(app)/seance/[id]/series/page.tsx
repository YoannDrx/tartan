import Link from "next/link";
import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { PerformedSetsEditor } from "@/features/athlete-view/performed-sets-editor";
import { orNotFound, requireAthleteSpace } from "@/features/shell/space";
import { getAthleteSession } from "@/server/athlete-view.service";

export default async function PerformedSetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, organizationId } = await requireAthleteSpace();
  const { id } = await params;
  const session = await orNotFound(() => getAthleteSession(actor.userId, organizationId, id));
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader
        title={m.progression.setsTitle}
        detail={session.title}
        before={
          <Link href={`/seance/${id}`} className="inline-flex min-h-11 items-center font-semibold">
            {m.common.back}
          </Link>
        }
      />
      {session.progressionEnabled ? (
        <PerformedSetsEditor session={session} organizationId={organizationId} userId={actor.userId} />
      ) : (
        <p>{m.progression.disabled}</p>
      )}
    </div>
  );
}
