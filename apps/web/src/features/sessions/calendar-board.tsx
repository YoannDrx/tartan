"use client";

import { activityColors } from "@/lib/activity-colors";
import type { CalendarResponse, CalendarSession } from "@tartan/contracts";
import { addDays } from "@tartan/domain";
import { capitalize, formatDateLong, formatWeekdayShort, m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Copy, Lock, Medal, MoveRight, Plus } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { ActivityPicto } from "@/components/pictos";
import { Chip } from "@/components/states";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { calendarSessionHref, newSessionHref } from "@/lib/session-navigation";
import { DeleteRow } from "@/features/athletes/delete-row";
import { MonthGrid, type MonthEntry } from "./month-grid";
import { dayClass, DropMarker, ForbiddenNote, PlanningLayer, usePlanning, type Planning } from "./planning-drag";

const t = w.planning;

const SessionCard = ({
  session,
  returnTo,
  planning,
}: {
  session: CalendarSession;
  returnTo?: string;
  planning: Planning;
}) => {
  const tint = activityColors(session.type);
  const item = planning.item(session);
  const held = planning.held(session.id);
  return (
    // La carte se saisit en entier : à la souris après quelques pixels, au doigt après un appui long.
    <article
      {...planning.card(item)}
      className={cn(
        "relative select-none overflow-hidden rounded-thumb border border-transparent bg-card-raised p-2 pr-3 [-webkit-touch-callout:none]",
        !item.locked && "cursor-grab",
        // Pendant le glisser, la carte reste à sa place, atténuée, dans un cadre en pointillés.
        held && "cursor-grabbing border-dashed border-control-line bg-transparent *:opacity-40",
      )}
    >
      <p
        className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 t-caption"
        style={{ backgroundColor: tint.background, color: tint.text }}
      >
        <ActivityPicto kind={session.type} className="size-4" />
        {m.sessionType[session.type]}
      </p>
      <Link
        scroll={false}
        draggable={false}
        href={calendarSessionHref(session.id, returnTo)}
        className="mt-0.5 block break-words font-semibold leading-snug text-fg no-underline hover:underline"
      >
        {session.title}
      </Link>
      <p className="t-caption mt-0.5 break-words font-normal text-soft">
        {[session.startTime?.replace(":", " h "), session.audience].filter(Boolean).join(", ")}
      </p>
      <div className="-mb-1 -mr-1 mt-1 flex flex-wrap items-center justify-end">
        <div className="mr-auto flex flex-wrap items-center gap-1">
          {!session.publishedAt ? <Chip tone="warning">{m.calendar.draft}</Chip> : null}
          {session.hasAutonomous ? (
            <>
              <Chip>{t.club}</Chip>
              <Chip>{t.autonomous}</Chip>
            </>
          ) : null}
        </div>
        {item.locked ? (
          // La séance d'un autre : visible, mais ni déplaçable ni duplicable par ce membre.
          <span
            className="inline-flex size-11 items-center justify-center text-soft"
            title={t.readOnlyHint(item.title)}
          >
            <Lock aria-hidden className="size-4" />
            <span className="sr-only">{t.readOnly}</span>
          </span>
        ) : (
          // Alternative au glisser-déposer, utilisable au clavier et au doigt (WCAG 2.5.7).
          <div className="flex">
            <IconButton
              data-plan-focus
              label={t.move(session.title)}
              onClick={() => planning.askMove(item)}
              className="text-soft hover:bg-card-line"
            >
              <MoveRight aria-hidden className="size-4" />
            </IconButton>
            <IconButton
              label={t.duplicate(session.title)}
              onClick={() => planning.askDuplicate(item)}
              className="text-soft hover:bg-card-line"
            >
              <Copy aria-hidden className="size-4" />
            </IconButton>
          </div>
        )}
      </div>
    </article>
  );
};

export const WeekBoard = ({
  week,
  today,
  data,
  readOnly,
  returnTo,
  groupId,
}: {
  week: string;
  today: string;
  data: CalendarResponse;
  /** Les séances que ce membre voit sans pouvoir les modifier. */
  readOnly?: string[];
  returnTo?: string;
  groupId?: string;
}) => {
  const planning = usePlanning(data.sessions, readOnly);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  return (
    <>
      {/* Une seule feuille à sept colonnes ; sur téléphone, un agenda où les jours vides restent courts. */}
      <div className="grid divide-y divide-card-line overflow-hidden rounded-card on-card bg-card desktop:grid-cols-7 desktop:divide-x desktop:divide-y-0">
        {days.map((day) => {
          const sessions = planning.sessions.filter((s) => s.date === day);
          const competitions = data.competitions.filter((c) => c.date === day);
          const state = planning.dayState(day);
          const marker = planning.markerAt(day);
          return (
            <section
              key={day}
              aria-label={capitalize(formatDateLong(day))}
              {...planning.day(day)}
              className={cn(
                "flex min-w-0 flex-col gap-2 border-t-[3px] border-transparent p-2 transition-colors desktop:min-h-[460px]",
                day === today && "border-lane",
                dayClass(state),
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <h2 className="flex items-center gap-1.5 pl-1">
                  <span className="t-caption">{formatWeekdayShort(day)}</span>
                  <span
                    className={cn(
                      "t-num flex min-w-7 items-center justify-center rounded-full text-[22px] leading-7",
                      day === today && "bg-accent px-1 text-on-accent",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                </h2>
                <Link
                  href={newSessionHref({ date: day, groupId, returnTo })}
                  aria-label={t.onDay(m.coach.newSession, formatDateLong(day))}
                  className="inline-flex size-11 items-center justify-center rounded-button text-soft hover:bg-raise hover:text-fg"
                >
                  <Plus aria-hidden className="size-4" />
                </Link>
              </div>
              {state === "locked" ? <ForbiddenNote /> : null}
              {competitions.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-1.5 rounded-thumb border border-control-line p-2 t-caption"
                >
                  <Medal aria-hidden className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 break-words">{c.name}</span>
                  <DeleteRow kind="competition" id={c.id} label={c.name} />
                </div>
              ))}
              {sessions.map((s, index) => (
                <Fragment key={s.id}>
                  {/* Le repère tient dans l'intervalle entre deux cartes : rien ne bouge autour. */}
                  <DropMarker show={marker === index} className="-my-1" />
                  <SessionCard session={s} returnTo={returnTo} planning={planning} />
                </Fragment>
              ))}
              <DropMarker show={marker === sessions.length} className="-my-1" />
            </section>
          );
        })}
      </div>
      <PlanningLayer planning={planning} />
    </>
  );
};

const entryOf = (session: CalendarSession, returnTo?: string): MonthEntry => ({
  id: session.id,
  date: session.date,
  title: session.title,
  type: session.type,
  href: calendarSessionHref(session.id, returnTo),
  detail: [session.startTime?.replace(":", " h "), session.audience].filter(Boolean).join(", "),
  draft: !session.publishedAt,
  progress: session.completion?.total
    ? m.calendar.progress(session.completion.done + session.completion.partial, session.completion.total)
    : session.publishedAt
      ? ""
      : undefined,
});

export const MonthBoard = ({
  month,
  today,
  data,
  readOnly,
  returnTo,
  groupId,
}: {
  month: string;
  today: string;
  data: CalendarResponse;
  /** Les séances que ce membre voit sans pouvoir les modifier. */
  readOnly?: string[];
  returnTo?: string;
  groupId?: string;
}) => {
  const planning = usePlanning(data.sessions, readOnly);
  return (
    <>
      <MonthGrid
        key={month}
        month={month}
        today={today}
        entries={planning.sessions.map((session) => entryOf(session, returnTo))}
        competitions={data.competitions.map((c) => ({
          ...c,
          action: <DeleteRow kind="competition" id={c.id} label={c.name} />,
        }))}
        newEntryHref={(date) => newSessionHref({ date, groupId, returnTo })}
        newEntryLabel={(date) => t.onDay(m.coach.newSession, formatDateLong(date))}
        planning={planning}
      />
      <PlanningLayer planning={planning} />
    </>
  );
};

// La liste du mois : une ligne par séance, la date en colonne, le prévu et le réalisé côte à côte.
export const ListBoard = ({
  month,
  today,
  data,
  returnTo,
}: {
  month: string;
  today: string;
  data: CalendarResponse;
  returnTo?: string;
}) => {
  const sessions = data.sessions.filter((s) => s.date.startsWith(month));
  const competitions = data.competitions.filter((c) => c.date.startsWith(month));
  const days = [...new Set([...sessions.map((s) => s.date), ...competitions.map((c) => c.date)])].sort();
  if (days.length === 0) return <p className="on-card rounded-card bg-card p-4 text-soft">{m.calendar.emptyMonth}</p>;
  return (
    <div className="on-card divide-y divide-card-line overflow-hidden rounded-card bg-card">
      {days.map((day) => (
        <section
          key={day}
          aria-label={capitalize(formatDateLong(day))}
          className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 px-3 py-2"
        >
          <h2 className="flex flex-col items-center leading-snug">
            <span className="t-caption">{formatWeekdayShort(day)}</span>
            <span
              className={cn(
                "t-num flex min-w-7 items-center justify-center rounded-full text-[22px] leading-7",
                day === today && "bg-accent px-1 text-on-accent",
              )}
            >
              {Number(day.slice(8))}
            </span>
          </h2>
          <ul className="flex min-w-0 flex-col gap-1">
            {competitions
              .filter((c) => c.date === day)
              .map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-1.5 rounded-thumb border border-control-line p-2 t-caption"
                >
                  <Medal aria-hidden className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 break-words">{c.name}</span>
                  <DeleteRow kind="competition" id={c.id} label={c.name} />
                </li>
              ))}
            {sessions
              .filter((s) => s.date === day)
              .map((s) => {
                const tint = activityColors(s.type);
                const summary = m.calendar.summary(s.durationMin, s.exerciseCount);
                return (
                  <li key={s.id}>
                    <Link
                      scroll={false}
                      href={calendarSessionHref(s.id, returnTo)}
                      className="flex min-h-11 items-center gap-3 rounded-thumb px-1 py-1 text-inherit no-underline hover:bg-raise"
                    >
                      <span
                        className="inline-flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 t-caption"
                        style={{ backgroundColor: tint.background, color: tint.text }}
                      >
                        <ActivityPicto kind={s.type} className="size-4" />
                        {m.sessionType[s.type]}
                      </span>
                      <span className="min-w-0 flex-1 leading-snug">
                        <span className="block break-words font-semibold">{s.title}</span>
                        <span className="t-caption block font-normal text-soft">
                          {[s.startTime?.replace(":", " h "), s.audience, summary].filter(Boolean).join(", ")}
                        </span>
                      </span>
                      {!s.publishedAt ? <Chip tone="warning">{m.calendar.draft}</Chip> : null}
                      {s.completion?.total ? (
                        <span className="t-num shrink-0 tabular-nums">
                          {m.calendar.progress(s.completion.done + s.completion.partial, s.completion.total)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
};
