import { CoachLog } from "@/features/tracking/coach-log";
import { Pencil, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDateLong, m, capitalize } from "@tartan/i18n";
import { Sheet } from "@/components/sheet";
import { Chip, EmptyState, PageHeader } from "@/components/states";
import { StatusIcon } from "@/components/status-cell";
import { Button } from "@/components/ui/button";
import { CommentThread } from "@/features/comments/thread";
import { orNotFound, requireStaffSpace } from "@/features/shell/space";
import { RemindButton, RollCall } from "@/features/tracking/session-followup";
import { listComments } from "@/server/comm.service";
import { getSessionDetailForCoach } from "@/server/tracking.service";

export const metadata: Metadata = { title: "Détail de la séance" };

const painLabel = (pain: { bodyArea: string; side: string; intensity: number }) => {
  const area = m.bodyArea[pain.bodyArea as keyof typeof m.bodyArea] ?? pain.bodyArea;
  const side = pain.side === "none" ? "" : ` ${m.bodySide[pain.side as keyof typeof m.bodySide].toLowerCase()}`;
  return `Douleur : ${area}${side}, ${pain.intensity}/10`;
};

export default async function SessionFollowupPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, organizationId, space } = await requireStaffSpace();
  const { id } = await params;
  const session = await orNotFound(() => getSessionDetailForCoach(actor.userId, organizationId, id));
  const comments = await orNotFound(() => listComments(actor.userId, organizationId, "session", id));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={session.title}
        detail={`${capitalize(formatDateLong(session.date))}${session.startTime ? ` à ${session.startTime.replace(":", " h ")}` : ""}${session.location ? `, ${session.location}` : ""}`}
        actions={
          <>
            {session.canEdit ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={`/seances/${id}`}>
                  <Pencil aria-hidden className="size-4" />
                  {m.common.edit}
                </Link>
              </Button>
            ) : null}
            {space.progressionEnabled && session.canEdit && session.publishedAt ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={`/seances/${id}/charges`}>{m.prescriptionRefresh.title}</Link>
              </Button>
            ) : null}
            {session.publishedAt ? <RemindButton sessionId={id} label={m.coach.remindAll} /> : null}
          </>
        }
      />
      {!session.publishedAt ? (
        <EmptyState>Cette séance est encore un brouillon : tes athlètes ne la voient pas.</EmptyState>
      ) : null}
      {session.publishedAt && session.athletes.length > 0 ? (
        <div className="grid items-start gap-6 desktop:grid-cols-[minmax(0,1fr)_380px]">
          <Sheet>
            <section aria-label={m.coach.athleteReturns}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-card-line bg-card-raised px-4 py-2">
                {(["done", "partial", "missed", "upcoming", "no_return"] as const).map((status) => {
                  const count = session.athletes.filter((a) => a.status === status).length;
                  return count > 0 ? (
                    <span key={status} className="flex items-center gap-1.5">
                      <StatusIcon status={status} size={18} />
                      <span className="t-num text-[17px] leading-5">{count}</span>
                      <span className="t-caption font-normal text-soft">{m.status[status]}</span>
                    </span>
                  ) : null;
                })}
              </div>
              <ul className="divide-y divide-card-line">
                {session.athletes.map((a) => (
                  <li
                    key={a.athleteId}
                    id={a.athleteId}
                    className="grid scroll-mt-20 grid-cols-[26px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 py-2"
                  >
                    <StatusIcon status={a.status} className="mt-px" />
                    <div className="min-w-0 leading-snug">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link
                          href={`/athletes/${a.athleteId}`}
                          className="break-words font-semibold text-inherit no-underline hover:underline"
                        >
                          {a.name}
                        </Link>
                        {a.variant ? <Chip>{m.variant[a.variant]}</Chip> : null}
                        {a.attendance === "absent" ? <Chip tone="warning">Absent</Chip> : null}
                      </p>
                      {a.rpe || a.durationMin ? (
                        <p className="t-num mt-0.5 text-[17px] leading-5">
                          {[a.rpe ? `Effort ${a.rpe}/10` : null, a.durationMin ? `${a.durationMin} min` : null]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      ) : null}
                      {a.pain ? (
                        <p className="mt-1 flex items-center gap-1.5 font-semibold text-st-missed">
                          <TriangleAlert aria-hidden className="size-4 shrink-0" />
                          {painLabel(a.pain)}
                        </p>
                      ) : null}
                      {a.comment ? <p className="mt-1 break-words">{a.comment}</p> : null}
                      {!a.hasAccount && a.status !== "done" && session.canEdit ? (
                        <div className="mt-2">
                          <CoachLog sessionId={id} athleteId={a.athleteId} />
                        </div>
                      ) : null}
                      {space.progressionEnabled && session.canEdit ? (
                        <Button asChild variant="secondary" size="sm" className="mt-2">
                          <Link
                            href={`/seances/${id}/athletes/${a.athleteId}/series`}
                            aria-label={`${m.progression.coachSetsTitle} · ${a.name}`}
                          >
                            {m.progression.coachSetsTitle}
                          </Link>
                        </Button>
                      ) : null}
                      {a.sets.length > 0 ? (
                        <p className="t-caption mt-1 font-normal text-soft">
                          {a.sets.filter((s) => s.done).length} séries cochées
                          {a.sets.some((s) => s.loadKg)
                            ? `, charges réelles : ${[...new Set(a.sets.filter((s) => s.loadKg).map((s) => String(s.loadKg).replace(".", ",")))].join(" / ")} kg`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                    {a.status === "missed" || a.status === "upcoming" ? (
                      <RemindButton sessionId={id} athleteIds={[a.athleteId]} label={m.coach.remind} />
                    ) : (
                      <span />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </Sheet>
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
      {session.publishedAt && session.athletes.length === 0 ? <EmptyState>{m.coach.noAthletes}</EmptyState> : null}
    </div>
  );
}
