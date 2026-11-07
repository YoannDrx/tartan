import Link from "next/link";
import { m } from "@tartan/i18n";
import { PerformedSetsEditor } from "@/features/athlete-view/performed-sets-editor";
import { orNotFound, requireAthleteSpace } from "@/features/shell/space";
import { getAthleteSession } from "@/server/athlete-view.service";

export default async function PerformedSetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, organizationId } = await requireAthleteSpace();
  const { id } = await params;
  const session = await orNotFound(() => getAthleteSession(actor.userId, organizationId, id));
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link href={`/seance/${id}`} className="inline-flex min-h-11 items-center font-semibold">
        {m.common.back}
      </Link>
      <h1 className="t-h1">{m.progression.setsTitle}</h1>
      <p>{session.title}</p>
      {session.progressionEnabled ? (
        <PerformedSetsEditor session={session} organizationId={organizationId} userId={actor.userId} />
      ) : (
        <p>{m.progression.disabled}</p>
      )}
    </div>
  );
}
