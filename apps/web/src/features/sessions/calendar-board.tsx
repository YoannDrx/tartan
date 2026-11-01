"use client";

import type { CalendarResponse, CalendarSession } from "@tartan/contracts";
import { addDays } from "@tartan/domain";
import { formatWeekdayShort, m } from "@tartan/i18n";
import { Copy, Medal, MoveRight, Plus } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chip } from "@/components/states";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { duplicateSessionAction, moveSessionAction } from "./session.action";

const SessionCard = ({
  session,
  onMove,
  onDuplicate,
}: {
  session: CalendarSession;
  onMove: () => void;
  onDuplicate: () => void;
}) => {
  const jump = session.type === "jump";
  return (
    <article
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/session-id", session.id)}
      className={cn(
        "rounded-card border p-2.5",
        jump ? "border-brand bg-brand text-white" : "border-border bg-surface",
      )}
    >
      <Link
        href={`/seances/${session.id}/suivi`}
        className={cn(
          "block font-semibold leading-tight no-underline hover:underline",
          jump ? "text-white" : "text-ink",
        )}
      >
        {session.title}
      </Link>
      <p className={cn("t-caption mt-1 font-normal", jump ? "text-white" : "text-muted")}>
        {[session.startTime?.replace(":", " h "), session.audience].filter(Boolean).join(", ")}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {!session.publishedAt ? <Chip tone="warning">{m.calendar.draft}</Chip> : null}
        {session.hasAutonomous ? (
          <>
            <Chip>Club</Chip>
            <Chip>Autonomie</Chip>
          </>
        ) : null}
      </div>
      {/* Alternative au glisser-déposer, utilisable au clavier et au doigt (WCAG 2.5.7). */}
      <div className="mt-1 flex justify-end">
        <IconButton
          label={`Déplacer ${session.title}`}
          onClick={onMove}
          className={jump ? "text-white hover:bg-brand-strong" : ""}
        >
          <MoveRight aria-hidden className="size-4" />
        </IconButton>
        <IconButton
          label={`Dupliquer ${session.title}`}
          onClick={onDuplicate}
          className={jump ? "text-white hover:bg-brand-strong" : ""}
        >
          <Copy aria-hidden className="size-4" />
        </IconButton>
      </div>
    </article>
  );
};

export const WeekBoard = ({ week, today, data }: { week: string; today: string; data: CalendarResponse }) => {
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
      <div className="grid gap-3 desktop:grid-cols-7">
        {days.map((day) => {
          const sessions = data.sessions.filter((s) => s.date === day);
          const competitions = data.competitions.filter((c) => c.date === day);
          return (
            <section
              key={day}
              aria-label={day}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/session-id");
                if (id) move.execute({ id, date: day });
              }}
              className="flex min-h-32 flex-col gap-2 rounded-block border border-border bg-bg p-2 desktop:min-h-[420px]"
            >
              <div className="flex items-center justify-between gap-1">
                <h2 className={cn("flex items-baseline gap-1.5", day === today && "text-brand-strong")}>
                  <span className="t-caption">{formatWeekdayShort(day)}</span>
                  <span className="t-num text-[22px] leading-none">{Number(day.slice(8))}</span>
                </h2>
                <Link
                  href={`/seances/nouvelle?date=${day}`}
                  aria-label={`${m.coach.newSession} le ${day}`}
                  className="inline-flex size-11 items-center justify-center rounded-button text-ink hover:bg-surface-sunk"
                >
                  <Plus aria-hidden className="size-4" />
                </Link>
              </div>
              {competitions.map((c) => (
                <p key={c.id} className="flex items-center gap-1.5 rounded-thumb bg-ink p-2 t-caption text-white">
                  <Medal aria-hidden className="size-4 shrink-0" />
                  {c.name}
                </p>
              ))}
              {sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
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
            {(a) => <Input {...a} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Button type="submit" disabled={move.isPending || duplicate.isPending}>
            {target?.mode === "move" ? "Déplacer" : m.calendar.duplicate}
          </Button>
        </form>
      </Dialog>
    </>
  );
};

export const MonthBoard = ({ month, today, data }: { month: string; today: string; data: CalendarResponse }) => {
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const start = addDays(`${month}-01`, -offset);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[720px] grid-cols-7 gap-px overflow-hidden rounded-block border border-border bg-border">
        {cells.map((day) => {
          const sessions = data.sessions.filter((s) => s.date === day);
          const competitions = data.competitions.filter((c) => c.date === day);
          const inMonth = day.startsWith(month);
          return (
            <div key={day} className={cn("min-h-24 bg-surface p-1.5", !inMonth && "bg-bg text-muted")}>
              <p className={cn("t-num text-[16px]", day === today && "text-brand-strong")}>{Number(day.slice(8))}</p>
              {competitions.map((c) => (
                <p
                  key={c.id}
                  className="mb-0.5 flex items-center gap-1 rounded bg-ink px-1 py-0.5 text-[12px] font-semibold text-white"
                >
                  <Medal aria-hidden className="size-3 shrink-0" />
                  <span className="truncate">{c.name}</span>
                </p>
              ))}
              {sessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/seances/${s.id}/suivi`}
                  className={cn(
                    "mb-0.5 block truncate rounded px-1 py-0.5 text-[12px] font-medium no-underline",
                    s.type === "jump" ? "bg-brand text-white" : "bg-bg text-ink",
                  )}
                >
                  {s.title}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
