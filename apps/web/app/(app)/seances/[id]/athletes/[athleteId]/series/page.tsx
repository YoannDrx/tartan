import { sessionReturnTo, withSessionReturn } from "@/lib/session-navigation";
import Link from "next/link";
import { m } from "@tartan/i18n";
import { PerformedSetsEditor } from "@/features/athlete-view/performed-sets-editor";
import { orNotFound, requireStaffSpace } from "@/features/shell/space";
import { getAthleteSessionForCoach } from "@/server/athlete-view.service";

export default async function CoachSetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; athleteId: string }>;
  searchParams: Promise<{ retour?: string }>;
}) {
  const { actor, organizationId } = await requireStaffSpace();
  const { id, athleteId } = await params;
  const returnTo = sessionReturnTo((await searchParams).retour);
  const session = await orNotFound(() => getAthleteSessionForCoach(actor.userId, organizationId, id, athleteId));
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link
        href={withSessionReturn(`/seances/${id}/suivi#${athleteId}`, returnTo)}
        className="inline-flex min-h-11 items-center font-semibold"
      >
        {m.common.back}
      </Link>
      <h1 className="t-h1">{m.progression.coachSetsTitle}</h1>
      <p className="font-semibold">{session.athlete?.name}</p>
      <p>{session.title}</p>
      {!session.progressionEnabled ? (
        <p>{m.progression.disabled}</p>
      ) : !session.canRecordSets ? (
        <p>{m.syncReview.reason.access}</p>
      ) : (
        <PerformedSetsEditor
          key={`${organizationId}.${id}.${athleteId}.${actor.userId}`}
          session={session}
          organizationId={organizationId}
          userId={actor.userId}
          athleteId={athleteId}
        />
      )}
    </div>
  );
}
