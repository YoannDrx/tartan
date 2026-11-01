import { Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { AthleteSessionCard, AthleteSessionDetail } from "@tartan/contracts";
import { capitalize, formatDateLong, formatWeekdayShort, m } from "@tartan/i18n";
import { EmptyState } from "@/components/states";
import { StatusIcon } from "@/components/status-cell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { todayIso } from "@/lib/dates";
import { AttendanceQuestion, TodayAbsence } from "@/features/athlete-view/attendance-question";
import { QuickValidate, ValidationFlusher } from "@/features/athlete-view/validation";
import { requireAthleteSpace } from "@/features/shell/space";
import { getAthleteSession, getAthleteToday } from "@/server/athlete-view.service";

export const metadata: Metadata = { title: m.nav.aujourdhui };

const WeekDots = ({ week, today }: { week: { date: string; status: string }[]; today: string }) => (
  <ol aria-label="Ta semaine" className="grid grid-cols-7 gap-1.5">
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
        <li
          key={d.date}
          className={cn(
            "flex flex-col items-center gap-1 rounded-button border bg-surface py-2",
            d.date === today ? "border-ink" : "border-border",
          )}
        >
          <span className="t-caption font-normal text-muted">{formatWeekdayShort(d.date)}</span>
          <span className="t-num text-[18px] leading-none">{Number(d.date.slice(8))}</span>
          <span className="flex h-3.5 items-center">
            {d.status === "done" || d.status === "partial" || d.status === "missed" ? (
              <StatusIcon status={d.status} size={14} />
            ) : null}
            {d.status === "today" ? (
              <span role="img" aria-label={label.today} className="size-2.5 rounded-full bg-brand" />
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
      <section
        aria-labelledby={`seance-${card.id}`}
        className="relative overflow-hidden rounded-hero bg-brand p-5 text-white"
      >
        <svg
          aria-hidden
          width="220"
          height="220"
          viewBox="0 0 220 220"
          className="absolute -right-20 -top-20 opacity-[0.12]"
        >
          <path d="M 20 220 A 200 200 0 0 1 220 20" fill="none" stroke="#fff" strokeWidth="4" />
          <path d="M 60 220 A 160 160 0 0 1 220 60" fill="none" stroke="#fff" strokeWidth="4" />
          <path d="M 100 220 A 120 120 0 0 1 220 100" fill="none" stroke="#fff" strokeWidth="4" />
        </svg>
        <div className="relative flex flex-col gap-3">
          <p className="flex flex-wrap items-center gap-2 t-caption font-semibold">
            <span className="rounded-full bg-white px-2.5 py-1 text-brand-strong">{m.sessionType[card.type]}</span>
            <span className="rounded-full border border-white px-2.5 py-1">{m.variant[card.variant]}</span>
          </p>
          <div>
            <h2 id={`seance-${card.id}`} className="font-display text-[30px] font-bold leading-[32px]">
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
            <QuickValidate session={card} organizationId={organizationId} healthConsent={healthConsent} onDark />
          )}
          <Button
            asChild
            size="md"
            variant={validated ? "inverse" : "quiet"}
            className={validated ? "" : "border border-white hover:bg-brand-strong"}
          >
            <Link href={`/seance/${card.id}/mode`} className="!text-white">
              <Play aria-hidden className="size-4 fill-current" />
              {m.today.start}
            </Link>
          </Button>
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
        <ul className="divide-y divide-border rounded-block border border-border bg-surface px-3">
          {exercises.map((item) => (
            <li key={item.ref}>
              <Link
                href={`/seance/${card.id}`}
                className="flex min-h-[60px] items-center gap-3 py-2 text-ink no-underline"
              >
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-thumb bg-surface-sunk"
                >
                  <Play className="size-4 fill-current" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="font-semibold">{item.name}</span>
                  <span className="t-caption font-normal text-muted">{item.summary}</span>
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
      <ValidationFlusher />
      <header>
        <p className="text-muted">{capitalize(formatDateLong(today))}</p>
        <h1 className="t-display">{data.firstName ? m.today.greeting(data.firstName) : m.nav.aujourdhui}</h1>
      </header>
      {data.parentalConsentPending ? (
        <p className="rounded-card bg-warning-tint p-3 text-warning-strong">{m.parental.pendingBanner}</p>
      ) : null}
      <WeekDots week={data.week} today={today} />
      {data.pinnedAnnouncement ? (
        <Link
          href="/annonces"
          className="rounded-card border border-border bg-surface p-3 text-ink no-underline hover:bg-bg"
        >
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
      {data.today.length === 0 ? <EmptyState>{data.next ? m.today.empty : m.today.noneYet}</EmptyState> : null}
      {data.next ? (
        <section className="flex flex-col gap-2">
          <h2 className="t-section">{m.today.next}</h2>
          <Link
            href={`/seance/${data.next.id}`}
            className={cn(
              "flex flex-col gap-0.5 rounded-card border p-3 no-underline",
              data.next.type === "jump"
                ? "border-brand bg-brand text-white"
                : "border-border bg-surface text-ink hover:bg-bg",
            )}
          >
            <span className="font-semibold">{data.next.title}</span>
            <span className="t-caption font-normal">
              {capitalize(formatDateLong(data.next.date))}, {m.variant[data.next.variant].toLowerCase()}
            </span>
          </Link>
          <AttendanceQuestion sessionId={data.next.id} current={data.next.attendance} />
        </section>
      ) : null}
    </div>
  );
}
