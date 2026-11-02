import { ChevronLeft, Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { capitalize, formatDateLong, m } from "@tartan/i18n";
import { Chip, PageHeader } from "@/components/states";
import { StatusIcon } from "@/components/status-cell";
import { Button } from "@/components/ui/button";
import { AttendanceQuestion, TodayAbsence } from "@/features/athlete-view/attendance-question";
import { todayIso } from "@/lib/dates";
import { QuickValidate } from "@/features/athlete-view/validation";
import { CommentThread } from "@/features/comments/thread";
import { orNotFound, requireAthleteSpace } from "@/features/shell/space";
import { getAthleteSession, getAthleteToday } from "@/server/athlete-view.service";
import { listComments } from "@/server/comm.service";

export const metadata: Metadata = { title: "Séance" };

export default async function SeancePage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, organizationId } = await requireAthleteSpace();
  const { id } = await params;
  const session = await orNotFound(() => getAthleteSession(actor.userId, organizationId, id));
  const [today, comments] = await Promise.all([
    getAthleteToday(actor.userId, organizationId),
    listComments(actor.userId, organizationId, "session", id),
  ]);
  const validated = session.status === "done" || session.status === "partial";
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link href="/aujourdhui" className="-mb-2 inline-flex min-h-11 items-center gap-1 self-start font-semibold">
        <ChevronLeft aria-hidden className="size-5" />
        {m.common.back}
      </Link>
      <PageHeader title={session.title} detail={capitalize(formatDateLong(session.date))} />
      <p className="flex flex-wrap items-center gap-2">
        {/* Sur le rouge, le statut reste sur l'encre : aucun disque de couleur directement sur le fond. */}
        <span className="on-card inline-flex rounded-full bg-card p-1">
          <StatusIcon status={session.status} />
        </span>
        <Chip>{m.sessionType[session.type]}</Chip>
        <Chip>{m.variant[session.variant]}</Chip>
        {session.startTime ? <span>{session.startTime.replace(":", " h ")}</span> : null}
        {session.location ? <span>{session.location}</span> : null}
      </p>
      {session.coachNote ? (
        <p>
          <span className="font-semibold">{m.today.coachWord} : </span>
          {session.coachNote}
        </p>
      ) : null}
      {!validated && session.date > todayIso() ? (
        <AttendanceQuestion sessionId={id} current={session.attendance} />
      ) : null}
      {!validated && session.date <= todayIso() ? (
        <div className="flex flex-col gap-2">
          <QuickValidate session={session} organizationId={organizationId} healthConsent={today.healthConsent} />
          {session.hasAutonomous ? <TodayAbsence sessionId={id} current={session.attendance} /> : null}
        </div>
      ) : null}
      <Button asChild size="lg" variant={validated || session.date <= todayIso() ? "secondary" : "primary"}>
        <Link href={`/seance/${id}/mode`}>
          <Play aria-hidden className="size-4 fill-current" />
          {m.today.start}
        </Link>
      </Button>
      {session.blocks.map((block) => (
        <section key={block.ref} className="flex flex-col gap-2">
          <h2 className="t-h2">{block.name}</h2>
          <ul className="divide-y divide-card-line rounded-card on-card bg-card px-3">
            {block.items.map((item) => (
              <li key={item.ref} className="py-2">
                <p className="font-semibold">{item.name}</p>
                <p className="t-caption font-normal text-soft">{item.summary}</p>
                {item.prescription.load?.type === "pct_1rm" && item.resolvedLoadKg === null ? (
                  <p className="t-caption text-st-partial">{m.today.loadMissing}</p>
                ) : null}
                {item.cues.length ? <p className="t-caption mt-1 font-normal">{item.cues.join(". ")}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <CommentThread
        entityType="session"
        entityId={id}
        comments={comments}
        currentUserId={actor.userId}
        path={`/seance/${id}`}
      />
    </div>
  );
}
