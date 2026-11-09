import { sessionReturnTo, withSessionReturn } from "@/lib/session-navigation";
import Link from "next/link";
import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
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
      <PageHeader
        title={m.progression.coachSetsTitle}
        detail={
          <>
            <span className="block font-semibold">{session.athlete?.name}</span>
            {session.title}
          </>
        }
        before={
          <Link
            href={withSessionReturn(`/seances/${id}/suivi#${athleteId}`, returnTo)}
            className="inline-flex min-h-11 items-center font-semibold"
          >
            {m.common.back}
          </Link>
        }
      />
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
