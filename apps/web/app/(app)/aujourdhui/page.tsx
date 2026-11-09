import { Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { AthleteSessionCard, AthleteSessionDetail, AthleteToday } from "@tartan/contracts";
import { capitalize, formatDateLong, formatWeekdayShort, m } from "@tartan/i18n";
import { ActivityPicto, LaneArcs } from "@/components/pictos";
import { EmptyState, PageHeader } from "@/components/states";
import { StatusIcon } from "@/components/status-cell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { todayIso } from "@/lib/dates";
import { AttendanceQuestion, TodayAbsence } from "@/features/athlete-view/attendance-question";
import { QuickValidate } from "@/features/athlete-view/validation";
import { requireAthleteSpace } from "@/features/shell/space";
import { getAthleteSession, getAthleteToday } from "@/server/athlete-view.service";

export const metadata: Metadata = { title: m.nav.aujourdhui };

const FocusBlock = ({ focus }: { focus: NonNullable<AthleteToday["focus"]> }) => (
  <section className="on-card flex flex-col gap-2 rounded-card bg-card p-4">
    <h2 className="t-section">{m.today.focusTitle}</h2>
    {focus.coachNote ? <p>{focus.coachNote}</p> : null}
    {focus.cues.length > 0 ? (
      <ul className="flex flex-col gap-1">
        {focus.cues.map((item) => (
          <li key={item.exercise}>
            <span className="font-semibold">{item.exercise} : </span>
            {item.cue}
          </li>
        ))}
      </ul>
    ) : null}
    {focus.video ? (
      <Link href={`/mes-sauts/${focus.video.id}`} className="flex min-h-11 items-center gap-2 text-inherit">
        <Play aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0">
          {focus.video.exerciseName ? <span className="font-semibold">{focus.video.exerciseName} : </span> : null}
          {focus.video.text}
        </span>
      </Link>
    ) : null}
  </section>
);

const WeekDots = ({ week, today }: { week: { date: string; status: string }[]; today: string }) => (
  <ol
    aria-label="Ta semaine"
    className="on-card grid grid-cols-7 divide-x divide-card-line overflow-hidden rounded-card bg-card"
  >
    {week.map((d) => {
      const label: Record<string, string> = {
        done: "séance faite",
        partial: "séance partielle",
        missed: "séance manquée",
        today: "séance du jour",
        planned: "séance prévue",
        rest: "repos",
      };
      return (
        <li key={d.date} className={cn("flex flex-col items-center gap-1 py-2", d.date === today && "bg-card-raised")}>
          <span className="t-caption font-normal text-soft">{formatWeekdayShort(d.date)}</span>
          <span className="t-num text-[20px] leading-none">{Number(d.date.slice(8))}</span>
          <span className="flex h-3.5 items-center">
            {d.status === "done" || d.status === "partial" || d.status === "missed" ? (
              <StatusIcon status={d.status} size={14} />
            ) : null}
            {d.status === "today" ? (
              <span role="img" aria-label={label.today} className="size-2.5 rounded-full bg-accent" />
            ) : null}
            {d.status === "planned" ? <StatusIcon status="upcoming" size={14} /> : null}
          </span>
          <span className="sr-only">{label[d.status]}</span>
        </li>
      );
    })}
  </ol>
);

const Hero = ({
  card,
  detail,
  organizationId,
  healthConsent,
}: {
  card: AthleteSessionCard;
  detail: AthleteSessionDetail;
  organizationId: string;
  healthConsent: boolean;
}) => {
  const validated = card.status === "done" || card.status === "partial";
  const exercises = detail.blocks.flatMap((b) => b.items);
  return (
    <>
      {/* Carte héros en rouge piste : les arcs reprennent le virage de l'élan. */}
      <section aria-labelledby={`seance-${card.id}`} className="on-hero relative overflow-hidden rounded-hero p-5">
        <LaneArcs weight={3} className="pointer-events-none absolute -bottom-2 right-0 h-3/4 w-1/2 text-surface-sunk" />
        <div className="relative flex flex-col gap-3">
          <p className="flex flex-wrap items-center gap-2 t-caption font-semibold">
            <span className="rounded-full bg-ink px-2.5 py-1 text-white">{m.sessionType[card.type]}</span>
            <span className="rounded-full border-2 border-ink px-2.5 py-0.5">{m.variant[card.variant]}</span>
          </p>
          <div>
            <h2 id={`seance-${card.id}`} className="t-h1 text-balance">
              {card.title}
            </h2>
            <p>
              {[
                card.startTime?.replace(":", " h "),
                card.durationMin ? `${card.durationMin} min` : null,
                `${card.exerciseCount} exercice${card.exerciseCount > 1 ? "s" : ""}`,
                card.coachName ? m.today.sentBy(card.coachName.split(" ")[0] ?? card.coachName) : null,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
          {validated ? (
            <p className="flex items-center gap-2 font-semibold">
              <StatusIcon status={card.status} /> {m.status[card.status as "done" | "partial"]} :{" "}
              {m.today.validated.toLowerCase()}
            </p>
          ) : (
            <QuickValidate session={detail} organizationId={organizationId} healthConsent={healthConsent} onDark />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="md" variant="secondary">
              <Link href={`/seance/${card.id}/mode`}>
                <Play aria-hidden className="size-4 fill-current" />
                {validated ? m.today.review : m.today.start}
              </Link>
            </Button>
            {/* La validation peut se refaire : c'est aussi le moyen de retirer une douleur saisie par erreur. */}
            {validated ? (
              <Button asChild size="md" variant="quiet">
                <Link href={`/seance/${card.id}/mode`}>{m.today.correct}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>
      {card.coachNote ? (
        <p>
          <span className="font-semibold">{m.today.coachWord} : </span>
          {card.coachNote}
        </p>
      ) : null}
      {!validated && card.hasAutonomous ? <TodayAbsence sessionId={card.id} current={card.attendance} /> : null}
      <section className="flex flex-col gap-2">
        <h2 className="t-section">{m.today.program}</h2>
        <ul className="divide-y divide-card-line rounded-card on-card bg-card px-3">
          {exercises.map((item) => (
            <li key={item.ref}>
              <Link
                href={`/seance/${card.id}`}
                className="flex min-h-[60px] items-center gap-3 py-2 text-inherit no-underline"
              >
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-thumb bg-accent text-on-accent"
                >
                  <Play className="size-4 fill-current" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-snug">
                  <span className="font-semibold">{item.name}</span>
                  <span className="t-caption font-normal text-soft">{item.summary}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
};

export default async function AujourdhuiPage() {
  const { actor, organizationId } = await requireAthleteSpace();
  const today = todayIso();
  const data = await getAthleteToday(actor.userId, organizationId);
  const details = await Promise.all(data.today.map((c) => getAthleteSession(actor.userId, organizationId, c.id)));
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader
        title={data.firstName ? m.today.greeting(data.firstName) : m.nav.aujourdhui}
        detail={capitalize(formatDateLong(today))}
      />
      {data.parentalConsentPending ? (
        <p className="on-card rounded-card bg-card p-3 text-st-partial">{m.parental.pendingBanner}</p>
      ) : null}
      <WeekDots week={data.week} today={today} />
      {data.pinnedAnnouncement ? (
        <Link href="/annonces" className="rounded-card on-card bg-card p-3 text-inherit no-underline hover:bg-raise">
          <span className="font-semibold">{data.pinnedAnnouncement.authorName} : </span>
          {data.pinnedAnnouncement.body}
        </Link>
      ) : null}
      {data.today.map((card, i) => {
        const detail = details[i];
        return detail ? (
          <Hero
            key={card.id}
            card={card}
            detail={detail}
            organizationId={organizationId}
            healthConsent={data.healthConsent}
          />
        ) : null;
      })}
      {data.focus ? <FocusBlock focus={data.focus} /> : null}
      {data.today.length === 0 ? <EmptyState>{data.next ? m.today.empty : m.today.noneYet}</EmptyState> : null}
      {data.next ? (
        <section className="flex flex-col gap-2">
          <h2 className="t-section">{m.today.next}</h2>
          <Link
            href={`/seance/${data.next.id}`}
            className="on-card flex items-center gap-3 rounded-card bg-card p-3 no-underline hover:bg-card-raised"
          >
            <ActivityPicto kind={data.next.type} className="size-5 text-fg-muted" />
            <span className="flex min-w-0 flex-col gap-0.5 text-fg">
              <span className="font-semibold">{data.next.title}</span>
              <span className="t-caption font-normal text-fg-muted">
                {capitalize(formatDateLong(data.next.date))}, {m.variant[data.next.variant].toLowerCase()}
              </span>
            </span>
          </Link>
          <AttendanceQuestion sessionId={data.next.id} current={data.next.attendance} />
        </section>
      ) : null}
    </div>
  );
}
