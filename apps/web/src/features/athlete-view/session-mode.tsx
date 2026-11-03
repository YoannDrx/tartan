"use client";

import type { AthleteSessionDetail, ExerciseMediaSnapshot, ResolvedItem } from "@tartan/contracts";
import { formatDuration } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { ArrowRight, Check, Timer, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ExternalVideo } from "@/features/exercises/exercise-video";
import { cn } from "@/lib/cn";
import { QuickValidate } from "./validation";

const SPEEDS = [0.25, 0.5, 1];

type Media = ExerciseMediaSnapshot & { streamUrl?: string };

const Demo = ({ item, speed }: { item: ResolvedItem; speed: number }) => {
  const media = item.media as Media | null;
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed;
  }, [speed]);
  if (media?.kind === "youtube" || media?.kind === "instagram") return <ExternalVideo media={media} title={item.name} />;
  if (media?.kind === "upload" && media.streamUrl) {
    return (
      <video
        ref={ref}
        src={media.streamUrl}
        autoPlay
        loop
        muted
        playsInline
        controls
        className="aspect-video w-full rounded-card bg-black"
        aria-label={`Démonstration : ${item.name}`}
      />
    );
  }
  return null;
};

export const SessionMode = ({
  session,
  organizationId,
  healthConsent,
}: {
  session: AthleteSessionDetail;
  organizationId: string;
  healthConsent: boolean;
}) => {
  const router = useRouter();
  const items = useMemo(() => session.blocks.flatMap((b) => b.items), [session.blocks]);
  const storageKey = `tartan.sets.${session.id}`;
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState(0.5);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [restLeft, setRestLeft] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      // Lecture après le rendu serveur, qui ne connaît pas le stockage du navigateur.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setChecked(JSON.parse(saved) as Record<string, boolean>);
    } catch {
      // Stockage indisponible : les séries cochées restent en mémoire.
    }
  }, [storageKey]);
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(checked));
    } catch {
      // Idem.
    }
  }, [checked, storageKey]);
  useEffect(() => {
    if (restLeft === null) return;
    const timer = setTimeout(() => {
      if (restLeft <= 1) navigator.vibrate?.(300);
      setRestLeft(restLeft <= 1 ? null : restLeft - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [restLeft]);

  const item = items[index];
  const sets = Object.entries(checked)
    .filter(([, done]) => done)
    .map(([key]) => {
      const [itemRef, setIndex] = key.split("#");
      return { itemRef: itemRef as string, setIndex: Number(setIndex), done: true };
    });

  if (!item) {
    return (
      <main className="scene-dark flex min-h-dvh flex-col items-start gap-4 bg-ink p-4 text-white">
        <p>{m.today.empty}</p>
        <Button variant="darkSecondary" onClick={() => router.back()}>
          {m.common.back}
        </Button>
      </main>
    );
  }
  const setCount = item.prescription.sets ?? 1;
  const doneCount = Array.from({ length: setCount }, (_, i) => checked[`${item.ref}#${i}`]).filter(Boolean).length;
  const last = index === items.length - 1;
  return (
    <main className="scene-dark min-h-dvh bg-ink text-white">
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <ConfirmDialog
            title={m.sessionMode.quitTitle}
            description={m.sessionMode.quitDetail}
            confirmLabel={m.sessionMode.quitAction}
            cancelLabel={m.sessionMode.quitStay}
            tone="neutral"
            onConfirm={() => router.push(`/seance/${session.id}`)}
            trigger={
              <IconButton tone="darkRound" label={m.sessionMode.quit}>
                <X aria-hidden className="size-5" />
              </IconButton>
            }
          />
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="t-caption font-normal text-soft">{m.sessionMode.exerciseOf(index + 1, items.length)}</span>
            <div className="flex gap-1" aria-hidden>
              {items.map((it, i) => (
                <span key={it.ref} className={cn("h-1 flex-1 rounded-sm", i <= index ? "bg-brand" : "bg-card-line")} />
              ))}
            </div>
          </div>
        </div>

        <h1 className="t-display">{item.name}</h1>

        <Demo item={item} speed={speed} />
        {(item.media as Media | null)?.kind === "upload" ? (
          <div role="group" aria-label={m.sessionMode.speed} className="flex items-center gap-2">
            <span className="t-caption font-normal text-soft">{m.sessionMode.speed}</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={speed === s}
                onClick={() => setSpeed(s)}
                className={cn(
                  "min-h-11 min-w-16 rounded-full px-3 font-semibold",
                  speed === s ? "bg-white text-ink" : "border border-control-line text-white",
                )}
              >
                {String(s).replace(".", ",")}×
              </button>
            ))}
          </div>
        ) : null}

        <p className="t-num text-[22px] leading-snug">{item.summary}</p>
        {item.prescription.load?.type === "pct_1rm" && item.resolvedLoadKg === null ? (
          <p className="text-link">{m.today.loadMissing}</p>
        ) : null}
        {item.prescription.notes ? <p>{item.prescription.notes}</p> : null}

        {item.cues.length ? (
          <ul className="flex list-disc flex-col gap-1.5 rounded-card bg-card-raised py-3 pl-8 pr-4">
            {item.cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ul>
        ) : null}

        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="t-section text-soft">{m.sessionMode.sets}</h2>
            <span className="t-num text-[20px]">
              {doneCount} / {setCount}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: setCount }, (_, i) => {
              const key = `${item.ref}#${i}`;
              const done = Boolean(checked[key]);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={done}
                  aria-label={done ? m.sessionMode.setDone(i + 1) : m.sessionMode.setTodo(i + 1)}
                  onClick={() => {
                    setChecked({ ...checked, [key]: !done });
                    if (!done && item.prescription.rest_s) setRestLeft(item.prescription.rest_s);
                  }}
                  className={cn(
                    "flex h-[60px] flex-col items-center justify-center rounded-card",
                    done ? "bg-st-done" : "border border-control-line bg-card-raised",
                  )}
                >
                  {done ? (
                    <Check aria-hidden className="size-5" strokeWidth={2.6} />
                  ) : (
                    <span className="t-num text-[20px]">{i + 1}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {item.prescription.rest_s ? (
          <div className="flex items-center gap-3 rounded-card bg-card-raised py-2.5 pl-4 pr-2.5">
            <Timer aria-hidden className="size-5 shrink-0 text-link" />
            <span className="flex-1">{m.sessionMode.rest}</span>
            <span role="timer" className="t-num text-[22px]">
              {formatDuration(restLeft ?? item.prescription.rest_s)}
            </span>
            <button
              type="button"
              onClick={() => setRestLeft(restLeft === null ? (item.prescription.rest_s ?? 0) : null)}
              className="min-h-11 rounded-full bg-white px-4 font-semibold text-ink"
            >
              {restLeft === null ? m.sessionMode.startRest : m.sessionMode.stopRest}
            </button>
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 pt-2">
          {last ? (
            <>
              <h2 className="t-h2">{m.validation.title}</h2>
              <QuickValidate
                session={session}
                organizationId={organizationId}
                healthConsent={healthConsent}
                sets={sets}
                onDark
              />
            </>
          ) : null}
          <div className="flex gap-2">
            <Button
              size="lg"
              variant="darkSecondary"
              className="flex-1"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              {m.sessionMode.previous}
            </Button>
            {!last ? (
              <Button size="lg" variant="darkPrimary" className="flex-[2]" onClick={() => setIndex(index + 1)}>
                {m.sessionMode.next}
                <ArrowRight aria-hidden className="size-5" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
};
