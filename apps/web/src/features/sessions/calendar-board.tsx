"use client";

import { activityColors } from "@/lib/activity-colors";
import { DateInput } from "@/components/ui/date-input";
import type { CalendarResponse, CalendarSession } from "@tartan/contracts";
import { addDays } from "@tartan/domain";
import { capitalize, formatDateLong, formatWeekdayShort, m } from "@tartan/i18n";
import { Copy, Medal, MoveRight, Plus } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActivityPicto } from "@/components/pictos";
import { Chip } from "@/components/states";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { calendarSessionHref, newSessionHref } from "@/lib/session-navigation";
import { duplicateSessionAction, moveSessionAction } from "./session.action";
import { DeleteRow } from "@/features/athletes/delete-row";
import { MonthGrid, type MonthEntry } from "./month-grid";

const SessionCard = ({
  session,
  returnTo,
  onMove,
  onDuplicate,
}: {
  session: CalendarSession;
  returnTo?: string;
  onMove: () => void;
  onDuplicate: () => void;
}) => {
  const tint = activityColors(session.type);
  return (
    <article
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/session-id", session.id)}
      className="relative cursor-grab overflow-hidden rounded-thumb bg-card-raised p-2 pr-3 active:cursor-grabbing"
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
              <Chip>Club</Chip>
              <Chip>Autonomie</Chip>
            </>
          ) : null}
        </div>
        {/* Alternative au glisser-déposer, utilisable au clavier et au doigt (WCAG 2.5.7). */}
        <div className="flex">
          <IconButton label={`Déplacer ${session.title}`} onClick={onMove} className="text-soft hover:bg-card-line">
            <MoveRight aria-hidden className="size-4" />
          </IconButton>
          <IconButton
            label={`Dupliquer ${session.title}`}
            onClick={onDuplicate}
            className="text-soft hover:bg-card-line"
          >
            <Copy aria-hidden className="size-4" />
          </IconButton>
        </div>
      </div>
    </article>
  );
};

export const WeekBoard = ({
  week,
  today,
  data,
  returnTo,
  groupId,
}: {
  week: string;
  today: string;
  data: CalendarResponse;
  returnTo?: string;
  groupId?: string;
}) => {
  const router = useRouter();
  const [target, setTarget] = useState<{ mode: "move" | "duplicate"; session: CalendarSession } | null>(null);
  const [date, setDate] = useState("");
  const onError = ({ error }: { error: { serverError?: string } }) =>
    toast.error(error.serverError ?? m.common.genericError);
  const move = useAction(moveSessionAction, {
    onSuccess: () => {
      setTarget(null);
      router.refresh();
    },
    onError,
  });
  const duplicate = useAction(duplicateSessionAction, {
    onSuccess: () => {
      toast.ok(m.calendar.duplicated);
      setTarget(null);
      router.refresh();
    },
    onError,
  });
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  return (
    <>
      {/* Une seule feuille à sept colonnes ; sur téléphone, un agenda où les jours vides restent courts. */}
      <div className="grid divide-y divide-card-line overflow-hidden rounded-card on-card bg-card desktop:grid-cols-7 desktop:divide-x desktop:divide-y-0">
        {days.map((day) => {
          const sessions = data.sessions.filter((s) => s.date === day);
          const competitions = data.competitions.filter((c) => c.date === day);
          return (
            <section
              key={day}
              aria-label={capitalize(formatDateLong(day))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/session-id");
                if (id) move.execute({ id, date: day });
              }}
              className={cn(
                "flex min-w-0 flex-col gap-2 border-t-[3px] border-transparent p-2 desktop:min-h-[460px]",
                day === today && "border-lane",
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
                  aria-label={`${m.coach.newSession} le ${formatDateLong(day)}`}
                  className="inline-flex size-11 items-center justify-center rounded-button text-soft hover:bg-raise hover:text-fg"
                >
                  <Plus aria-hidden className="size-4" />
                </Link>
              </div>
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
              {sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  returnTo={returnTo}
                  onMove={() => {
                    setDate(s.date);
                    setTarget({ mode: "move", session: s });
                  }}
                  onDuplicate={() => {
                    setDate(addDays(s.date, 7));
                    setTarget({ mode: "duplicate", session: s });
                  }}
                />
              ))}
            </section>
          );
        })}
      </div>
      <Dialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title={target?.mode === "move" ? "Déplacer la séance" : m.calendar.duplicate}
        description={target?.session.title}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!target) return;
            if (target.mode === "move") move.execute({ id: target.session.id, date });
            else duplicate.execute({ id: target.session.id, date });
          }}
        >
          <Field label={m.builder.date}>
            {(a) => <DateInput {...a} required value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Button type="submit" disabled={move.isPending || duplicate.isPending}>
            {target?.mode === "move" ? "Déplacer" : m.calendar.duplicate}
          </Button>
        </form>
      </Dialog>
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
  returnTo,
  groupId,
}: {
  month: string;
  today: string;
  data: CalendarResponse;
  returnTo?: string;
  groupId?: string;
}) => {
  const router = useRouter();
  const move = useAction(moveSessionAction, {
    onSuccess: () => router.refresh(),
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  return (
    <MonthGrid
      key={month}
      month={month}
      today={today}
      entries={data.sessions.map((session) => entryOf(session, returnTo))}
      competitions={data.competitions.map((c) => ({
        ...c,
        action: <DeleteRow kind="competition" id={c.id} label={c.name} />,
      }))}
      newEntryHref={(date) => newSessionHref({ date, groupId, returnTo })}
      newEntryLabel={(date) => `${m.coach.newSession} le ${formatDateLong(date)}`}
      onMove={(id, date) => move.execute({ id, date })}
    />
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
                <li key={c.id} className="flex items-center gap-1.5 rounded-thumb border border-control-line p-2 t-caption">
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
