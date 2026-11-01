import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDateLong, m, capitalize } from "@tartan/i18n";
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
  const { actor, organizationId } = await requireStaffSpace();
  const { id } = await params;
  const session = await orNotFound(() => getSessionDetailForCoach(actor.userId, organizationId, id));
  const comments = await orNotFound(() => listComments(actor.userId, organizationId, "session", id));
  return (
    <div className="flex flex-col gap-6">
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
            {session.publishedAt ? <RemindButton sessionId={id} label={m.coach.remindAll} /> : null}
          </>
        }
      />
      {!session.publishedAt ? (
        <EmptyState>Cette séance est encore un brouillon : tes athlètes ne la voient pas.</EmptyState>
      ) : null}
      {session.publishedAt && session.athletes.length > 0 ? (
        <div className="grid gap-6 desktop:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-label="Retours des athlètes" className="rounded-block border border-border bg-surface">
            <ul className="divide-y divide-border">
              {session.athletes.map((a) => (
                <li key={a.athleteId} id={a.athleteId} className="flex flex-wrap items-start gap-3 p-3">
                  <StatusIcon status={a.status} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/athletes/${a.athleteId}`}
                        className="font-semibold text-ink no-underline hover:underline"
                      >
                        {a.name}
                      </Link>
                      {a.variant ? <Chip>{m.variant[a.variant]}</Chip> : null}
                      {a.attendance === "absent" ? <Chip tone="warning">Absent</Chip> : null}
                    </p>
                    <p className="t-caption font-normal text-muted">
                      {[a.rpe ? `Effort ${a.rpe}/10` : null, a.durationMin ? `${a.durationMin} min` : null]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    {a.pain ? <p className="mt-1 font-semibold text-brand-strong">{painLabel(a.pain)}</p> : null}
                    {a.comment ? <p className="mt-1">{a.comment}</p> : null}
                    {a.sets.length > 0 ? (
                      <p className="t-caption mt-1 font-normal text-muted">
                        {a.sets.filter((s) => s.done).length} séries cochées
                        {a.sets.some((s) => s.loadKg)
                          ? `, charges réelles : ${[...new Set(a.sets.filter((s) => s.loadKg).map((s) => String(s.loadKg).replace(".", ",")))].join(" / ")} kg`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  {a.status === "missed" || a.status === "upcoming" ? (
                    <RemindButton sessionId={id} athleteIds={[a.athleteId]} label={m.coach.remind} />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
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
