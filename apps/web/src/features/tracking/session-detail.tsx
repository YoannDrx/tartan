import { sessionReturnTo, withSessionReturn } from "@/lib/session-navigation";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { formatDateLong, m, capitalize } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { EmptyState, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { CommentThread } from "@/features/comments/thread";
import { orNotFound, requireStaffSpace } from "@/features/shell/space";
import { RemindButton, RollCall } from "@/features/tracking/session-followup";
import { SessionReturns } from "@/features/tracking/session-returns";
import { listComments } from "@/server/comm.service";
import { getSessionDetailForCoach } from "@/server/tracking.service";

export async function SessionFollowupContent({
  params,
  searchParams,
  compact = false,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retour?: string }>;
  compact?: boolean;
}) {
  const { actor, organizationId, space } = await requireStaffSpace();
  const { id } = await params;
  const returnTo = sessionReturnTo((await searchParams).retour);
  const session = await orNotFound(() => getSessionDetailForCoach(actor.userId, organizationId, id));
  const comments = await orNotFound(() => listComments(actor.userId, organizationId, "session", id));
  return (
    <div className="flex flex-col gap-4">
      {returnTo && !compact ? (
        <Link href={returnTo} className="inline-flex min-h-11 items-center font-semibold">
          {m.calendar.backToContext}
        </Link>
      ) : null}
      <PageHeader
        title={session.title}
        detail={`${capitalize(formatDateLong(session.date))}${session.startTime ? w.tracking.startsAt(session.startTime) : ""}${session.location ? `, ${session.location}` : ""}`}
        actions={
          <>
            {session.canEdit ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={withSessionReturn(`/seances/${id}`, returnTo)}>
                  <Pencil aria-hidden className="size-4" />
                  {m.common.edit}
                </Link>
              </Button>
            ) : null}
            {space.progressionEnabled && session.canEdit && session.publishedAt ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={withSessionReturn(`/seances/${id}/charges`, returnTo)}>{m.prescriptionRefresh.title}</Link>
              </Button>
            ) : null}
            {session.publishedAt ? <RemindButton sessionId={id} label={m.coach.remindAll} /> : null}
          </>
        }
      />
      {!session.publishedAt ? <EmptyState rubric="suivi">{m.coach.draftHidden}</EmptyState> : null}
      {session.publishedAt && session.athletes.length > 0 ? (
        <div
          className={compact ? "flex flex-col gap-6" : "grid items-start gap-6 desktop:grid-cols-[minmax(0,1fr)_380px]"}
        >
          <SessionReturns
            sessionId={id}
            athletes={session.athletes}
            canEdit={session.canEdit}
            progressionEnabled={space.progressionEnabled === true}
            returnTo={returnTo}
          />
          <div className="flex flex-col gap-6">
            <RollCall
              sessionId={id}
              hasAutonomous={session.hasAutonomous}
              rows={session.athletes.map((a) => ({ athleteId: a.athleteId, name: a.name, attendance: a.attendance }))}
            />
            <CommentThread
              entityType="session"
              entityId={id}
              comments={comments}
              currentUserId={actor.userId}
              path={`/seances/${id}/suivi`}
            />
          </div>
        </div>
      ) : null}
      {session.publishedAt && session.athletes.length === 0 ? (
        <EmptyState rubric="suivi">{m.coach.noAthletes}</EmptyState>
      ) : null}
    </div>
  );
}
