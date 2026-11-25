import { ActivityPicto } from "@/components/pictos";
import { categoryColors } from "@/lib/activity-colors";
import { ExerciseVoice, SessionDebrief } from "@/features/sessions/session-voice";
import { MovementGuideDisclosure } from "@/features/exercises/exercise-guide";
import { ChevronLeft, Play, Timer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { capitalize, formatDateLong, m } from "@tartan/i18n";
import { Chip, PageHeader } from "@/components/states";
import { StatusIcon } from "@/components/status-cell";
import { Button } from "@/components/ui/button";
import { Stay } from "@/components/ui/view-transition";
import { AttendanceQuestion, TodayAbsence } from "@/features/athlete-view/attendance-question";
import { sessionCardName } from "@/features/athlete-view/session-card";
import { todayIso } from "@/lib/dates";
import { QuickValidate } from "@/features/athlete-view/validation";
import { CommentThread } from "@/features/comments/thread";
import { orNotFound, requireAthleteSpace } from "@/features/shell/space";
import { getAthleteSession, getAthleteToday } from "@/server/athlete-view.service";
import { listComments } from "@/server/comm.service";

export const metadata: Metadata = { title: m.sessionMode.title };

export default async function SeancePage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, organizationId, personal } = await requireAthleteSpace();
  const { id } = await params;
  const session = await orNotFound(() => getAthleteSession(actor.userId, organizationId, id));
  const [today, comments] = await Promise.all([
    getAthleteToday(actor.userId, organizationId),
    listComments(actor.userId, organizationId, "session", id),
  ]);
  const validated = session.status === "done" || session.status === "partial";
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={session.title}
        detail={capitalize(formatDateLong(session.date))}
        before={
          <Link href="/aujourdhui" className="-mb-2 inline-flex min-h-11 items-center gap-1 self-start font-semibold">
            <ChevronLeft aria-hidden className="size-5" />
            {m.common.back}
          </Link>
        }
      />
      {/* La feuille de la séance : la carte de l'accueil s'ouvre en elle. */}
      <Stay name={sessionCardName(id)}>
        <section aria-label={session.title} className="on-card flex flex-col gap-3 rounded-card bg-card p-4">
          <p className="flex flex-wrap items-center gap-2">
            <StatusIcon status={session.status} />
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
          {!personal && !validated && session.date > todayIso() ? (
            <AttendanceQuestion sessionId={id} current={session.attendance} />
          ) : null}
          {!validated && session.date <= todayIso() ? (
            <div className="flex flex-col gap-2">
              <QuickValidate session={session} organizationId={organizationId} healthConsent={today.healthConsent} />
              {!personal && session.hasAutonomous ? <TodayAbsence sessionId={id} current={session.attendance} /> : null}
            </div>
          ) : null}
          <Button asChild size="lg" variant={validated || session.date <= todayIso() ? "secondary" : "primary"}>
            <Link href={`/seance/${id}/mode`}>
              <Play aria-hidden className="size-4 fill-current" />
              {validated ? m.today.review : m.today.start}
            </Link>
          </Button>
          {session.progressionEnabled ? (
            <Button asChild variant="secondary">
              <Link href={`/seance/${id}/series`}>{m.progression.setsTitle}</Link>
            </Button>
          ) : null}
        </section>
      </Stay>
      {session.status === "done" && today.healthConsent && !personal ? (
        <SessionDebrief
          organizationId={organizationId}
          sessionId={id}
          initial={Boolean(session.log?.hasVoiceDebrief)}
        />
      ) : null}
      {session.blocks.map((block) => (
        <section key={block.ref} className="flex flex-col gap-3">
          <h2 className="t-h2">{block.name}</h2>
          <ul className="flex flex-col gap-3">
            {block.items.map((item) => {
              const recovery = item.kind === "recovery";
              const tint = categoryColors(recovery ? "mobility" : item.category);
              return (
                <li
                  key={item.ref}
                  className="on-card flex min-w-0 flex-col gap-3 rounded-card border bg-card p-4 tablet:px-5"
                  style={{ borderColor: tint.background }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-button"
                      style={{ backgroundColor: tint.background, color: tint.text }}
                    >
                      {recovery ? (
                        <Timer aria-hidden className="size-5" />
                      ) : (
                        <ActivityPicto kind={item.category} className="size-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h3 className="t-section break-words">{item.name}</h3>
                      {item.summary ? <p className="text-soft">{item.summary}</p> : null}
                    </div>
                  </div>
                  {item.prescription.load?.type === "pct_1rm" && item.resolvedLoadKg === null ? (
                    <p className="text-link">{m.today.loadMissing}</p>
                  ) : null}
                  {item.prescription.notes || item.prescription.coachVoiceId || item.cues.length ? (
                    <div className="flex flex-col gap-2 border-t border-card-line pt-3">
                      <p className="font-semibold">{m.sessionMode.cues}</p>
                      {item.prescription.notes ? (
                        <p className="whitespace-pre-line break-words">{item.prescription.notes}</p>
                      ) : null}
                      <ExerciseVoice
                        organizationId={organizationId}
                        sessionId={id}
                        clipId={item.prescription.coachVoiceId}
                      />
                      {item.cues.length ? (
                        <ul className="list-disc space-y-1 pl-5">
                          {item.cues.map((cue, i) => (
                            <li key={i}>{cue}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                  {item.guide ? <MovementGuideDisclosure guide={item.guide} /> : null}
                </li>
              );
            })}
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
