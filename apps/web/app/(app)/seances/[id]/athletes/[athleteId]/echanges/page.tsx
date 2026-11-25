import Link from "next/link";
import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { SessionThread } from "@/features/sessions/session-thread";
import { orNotFound, requireStaffSpace } from "@/features/shell/space";
import { sessionReturnTo, withSessionReturn } from "@/lib/session-navigation";
import { getAthleteSessionForCoach } from "@/server/athlete-view.service";

export default async function CoachSessionThreadsPage({
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
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <PageHeader
        title={m.sessionThread.coachThreads}
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
      {session.log?.status === "done" && session.healthConsent && (
        <section className="on-card grid min-w-0 gap-3 rounded-card bg-card p-4">
          <h2 className="t-section">{m.sessionVoice.debrief}</h2>
          <SessionThread organizationId={organizationId} sessionId={id} athleteId={athleteId} />
        </section>
      )}
      {session.blocks.map((block) => (
        <section key={block.ref} className="grid min-w-0 gap-2">
          <h2 className="t-h2">{block.name}</h2>
          {block.items
            .filter((item) => item.kind !== "recovery")
            .map((item) => (
              <article key={item.ref} className="on-card grid min-w-0 gap-2 rounded-card bg-card p-4">
                <h3 className="t-section break-words">{item.name}</h3>
                {item.prescription.notes && (
                  <p className="whitespace-pre-wrap break-words">{item.prescription.notes}</p>
                )}
                <SessionThread
                  organizationId={organizationId}
                  sessionId={id}
                  athleteId={athleteId}
                  itemRef={item.ref}
                />
              </article>
            ))}
        </section>
      ))}
    </div>
  );
}
