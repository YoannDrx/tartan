import { Play, SquarePen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { AthleteSessionCard, AthleteSessionDetail, AthleteToday } from "@tartan/contracts";
import { athleteWelcomeMode, programItems } from "@tartan/domain";
import { capitalize, formatDateLong, formatWeekdayShort, m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { ActivityPicto, LaneArcs } from "@/components/pictos";
import { EmptyState, PageHeader } from "@/components/states";
import { StatusIcon } from "@/components/status-cell";
import { Button } from "@/components/ui/button";
import { Stay } from "@/components/ui/view-transition";
import { TrackLap } from "@/components/track";
import { cn } from "@/lib/cn";
import { todayIso } from "@/lib/dates";
import { AthleteExtras } from "@/features/athlete-view/athlete-extras";
import { AthleteWelcome } from "@/features/athlete-view/athlete-welcome";
import { AttendanceQuestion, TodayAbsence } from "@/features/athlete-view/attendance-question";
import { sessionCardName } from "@/features/athlete-view/session-card";
import { QuickValidate } from "@/features/athlete-view/validation";
import { requireAthleteSpace } from "@/features/shell/space";
import { PasswordPrompt } from "@/features/auth/password-prompt";
import { getAthleteSession, getAthleteToday, getAthleteWelcome } from "@/server/athlete-view.service";
import { getSignInMethods } from "@/server/credentials.service";
import { getMe } from "@/server/me.service";
import { getGuideContext, getOnboarding } from "@/server/onboarding.service";
import { PersonalGuide } from "@/features/onboarding/personal-guide";

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
      <Link href={`/mes-videos/${focus.video.id}`} className="flex min-h-11 items-center gap-2 text-inherit">
        <Play aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0">
          {focus.video.exerciseName ? <span className="font-semibold">{focus.video.exerciseName} : </span> : null}
          {focus.video.text}
        </span>
      </Link>
    ) : null}
  </section>
);

// La série de régularité : le tour de piste se court au fil des séances rendues de la semaine, le chiffre au centre
// compte les semaines de suite (packages/domain/src/regularity.ts).
const Regularity = ({ weeks, planned, validated }: { weeks: number; planned: number; validated: number }) => (
  <section aria-labelledby="regularite" className="on-card flex items-center gap-4 rounded-card bg-card p-3">
    <TrackLap
      value={planned === 0 ? 0 : validated / planned}
      label={m.today.regularity.lap(validated, planned)}
      className="w-24 shrink-0"
    >
      <span aria-hidden className="t-num text-[28px] leading-none">
        {weeks}
      </span>
    </TrackLap>
    <div className="flex min-w-0 flex-col gap-0.5">
      <h2 id="regularite" className="t-h2">
        {m.today.regularity.title}
      </h2>
      <p className="font-semibold">
        {weeks > 0 ? `${weeks} ${m.today.regularity.weeks(weeks)}` : m.today.regularity.weeks(0)}
      </p>
      <p className="t-caption font-normal text-soft">{m.today.regularity.rule}</p>
    </div>
  </section>
);

const WeekDots = ({ week, today }: { week: { date: string; status: string }[]; today: string }) => (
  <ol
    aria-label={m.today.weekLabel}
    className="on-card grid grid-cols-7 divide-x divide-card-line overflow-hidden rounded-card bg-card"
  >
    {week.map((d) => {
      const label: Record<string, string> = m.today.weekStatus;
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
  personal,
}: {
  card: AthleteSessionCard;
  detail: AthleteSessionDetail;
  organizationId: string;
  healthConsent: boolean;
  // Espace personnel : ni coach à nommer, ni présence à annoncer.
  personal: boolean;
}) => {
  const validated = card.status === "done" || card.status === "partial";
  // Un circuit repasse par les mêmes exercices : le programme les montre une fois, avec leurs passages.
  const exercises = programItems(detail.blocks.flatMap((b) => b.items));
  return (
    <>
      {/* La carte de la séance du jour : en l'ouvrant, elle devient la feuille de l'écran de séance. */}
      <Stay name={sessionCardName(card.id)}>
        <section aria-labelledby={`seance-${card.id}`} className="on-hero relative overflow-hidden rounded-hero p-5">
          <LaneArcs
            weight={3}
            className="pointer-events-none absolute -bottom-2 right-0 h-3/4 w-1/2 text-surface-sunk"
          />
          <div className="relative flex flex-col gap-3">
            <p className="flex flex-wrap items-center gap-2 t-caption font-semibold">
              <span className="rounded-full bg-ink px-2.5 py-1 text-on-ink">{m.sessionType[card.type]}</span>
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
                  m.today.exerciseCount(card.exerciseCount),
                  card.coachName && !personal ? m.today.sentBy(card.coachName.split(" ")[0] ?? card.coachName) : null,
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
      </Stay>
      {card.coachNote ? (
        <p>
          <span className="font-semibold">{m.today.coachWord} : </span>
          {card.coachNote}
        </p>
      ) : null}
      {!validated && card.hasAutonomous && !personal ? (
        <TodayAbsence sessionId={card.id} current={card.attendance} />
      ) : null}
      <section className="flex flex-col gap-2">
        <h2 className="t-section">{m.today.program}</h2>
        <ul className="divide-y divide-card-line rounded-card on-card bg-card px-3">
          {exercises.map(({ item, passes }) => (
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
                  <span className="t-caption font-normal text-soft">
                    {passes > 1 ? `${item.summary}, ${m.today.passes(passes)}` : item.summary}
                  </span>
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
  const { actor, organizationId, personal, space } = await requireAthleteSpace();
  const today = todayIso();
  const [data, welcome, methods, onboarding, me, guide] = await Promise.all([
    getAthleteToday(actor.userId, organizationId),
    getAthleteWelcome(actor.userId, organizationId),
    getSignInMethods(actor),
    getOnboarding(actor.userId, organizationId),
    getMe(actor.userId),
    // L'athlète autonome a ses premiers pas : deux modèles de départ pour planifier sa première séance.
    personal ? getGuideContext(actor.userId, organizationId) : null,
  ]);
  const personalGuide =
    personal && guide && onboarding.personal?.guideVisible
      ? {
          ...onboarding.personal,
          dismissedAt: onboarding.dismissedAt,
          templates: guide.templates,
          plannerAvailable: Boolean(space.aiPlannerEnabled),
        }
      : null;
  const details = await Promise.all(data.today.map((c) => getAthleteSession(actor.userId, organizationId, c.id)));
  // L'accueil ne retarde jamais la séance : un jour de séance, il tient en une ligne sous elle.
  const welcomeMode = athleteWelcomeMode({
    eligible: welcome !== null,
    welcomeSeenAt: onboarding.welcomeSeenAt,
    sessionToday: data.today.length > 0,
  });
  const passwordPrompt = methods.passwordPrompt ? { email: methods.email, canSetNow: methods.canSetPasswordNow } : null;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader
        title={data.firstName ? m.today.greeting(data.firstName) : m.nav.aujourdhui}
        detail={capitalize(formatDateLong(today))}
        actions={
          personal ? (
            <Button asChild size="sm">
              <Link href="/seances/nouvelle?retour=%2Faujourdhui">
                <SquarePen aria-hidden className="size-4" />
                {w.personal.planSession}
              </Link>
            </Button>
          ) : undefined
        }
      />
      {data.parentalConsentPending ? (
        <p className="on-card rounded-card bg-card p-3 text-st-partial">{m.parental.pendingBanner}</p>
      ) : null}
      {/* Sans séance du jour, l'accueil ouvre l'écran. */}
      {welcome && welcomeMode === "panels" ? (
        <AthleteWelcome mode="panels" group={welcome.group} coach={welcome.coach} />
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
            personal={personal}
          />
        ) : null;
      })}
      {/* Un jour de séance, la séance passe devant : l'accueil n'est qu'une ligne, dessous. */}
      {welcome && welcomeMode === "line" ? (
        <AthleteWelcome mode="line" group={welcome.group} coach={welcome.coach} />
      ) : null}
      {data.focus ? <FocusBlock focus={data.focus} /> : null}
      {data.today.length === 0 ? (
        <EmptyState
          rubric="aujourdhui"
          action={
            personal ? (
              <Button asChild size="sm" variant="secondary">
                <Link href="/seances/nouvelle?retour=%2Faujourdhui">{w.personal.planSession}</Link>
              </Button>
            ) : undefined
          }
        >
          {personal ? w.personal.todayEmpty : data.next ? m.today.empty : m.today.noneYet}
        </EmptyState>
      ) : null}
      {/* Ses premiers pas, après la séance du jour : rien ne passe devant elle. */}
      {personalGuide ? <PersonalGuide data={personalGuide} place="today" /> : null}
      {/* Après la séance du jour, jamais avant. Après la première validation, une carte facultative regroupe photo,
          mot de passe, installation et notifications ; avant, seule la proposition de mot de passe est là. */}
      {onboarding.extrasVisible ? (
        <AthleteExtras photo={!me.avatarUrl} password={passwordPrompt} />
      ) : passwordPrompt ? (
        <PasswordPrompt email={passwordPrompt.email} canSetNow={passwordPrompt.canSetNow} />
      ) : null}
      {data.next ? (
        <section className="flex flex-col gap-2">
          <h2 className="t-section">{m.today.next}</h2>
          <Stay name={sessionCardName(data.next.id)}>
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
          </Stay>
          {personal ? null : <AttendanceQuestion sessionId={data.next.id} current={data.next.attendance} />}
        </section>
      ) : null}
      {/* La série vient après les séances : l'athlète vient d'abord pour elles. */}
      {data.regularity ? <Regularity {...data.regularity} /> : null}
    </div>
  );
}
