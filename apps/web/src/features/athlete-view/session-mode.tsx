"use client";

import type { AthleteSessionDetail, ExerciseMediaSnapshot, ResolvedItem } from "@tartan/contracts";
import { formatDuration } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { ArrowRight, Check, Timer, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ExternalVideo } from "@/features/exercises/exercise-video";
import { cn } from "@/lib/cn";
import { MovementGuideDisclosure } from "@/features/exercises/exercise-guide";
import { QuickValidate } from "./validation";

const SPEEDS = [0.25, 0.5, 1];

type Media = ExerciseMediaSnapshot & { streamUrl?: string };

const Demo = ({ item, speed }: { item: ResolvedItem; speed: number }) => {
  const media = item.media as Media | null;
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed;
  }, [speed]);
  if (media?.kind === "youtube" || media?.kind === "instagram")
    return <ExternalVideo media={media} title={item.name} />;
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
        className="aspect-video w-full rounded-card bg-ink"
        aria-label={m.builder.sequence.demo(item.name)}
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
  // La fin du repos est une heure, pas un compte à rebours : un onglet en arrière-plan ne le fait pas dériver.
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announce, setAnnounce] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const restLeft = restEnd === null ? null : Math.max(0, Math.ceil((restEnd - now) / 1000));
  const startRest = (seconds: number | null | undefined) => setRestEnd(seconds ? Date.now() + seconds * 1000 : null);
  const go = useCallback(
    (next: number) => {
      setRestEnd(null);
      setIndex(Math.max(0, Math.min(next, items.length - 1)));
    },
    [items.length],
  );

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
    if (restEnd === null) return;
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [restEnd]);
  // Fin du repos : vibration, signal court et annonce ; une récupération de circuit enchaîne sur l'étape suivante.
  useEffect(() => {
    if (restEnd === null || now < restEnd) return;
    navigator.vibrate?.(300);
    try {
      const context = audio.current;
      if (context) {
        const tone = context.createOscillator();
        tone.frequency.value = 880;
        tone.connect(context.destination);
        tone.start();
        tone.stop(context.currentTime + 0.2);
      }
    } catch {
      // Son indisponible : la vibration et l'annonce suffisent.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la fin du repos est un événement du minuteur
    setAnnounce(m.sessionMode.restOver);
    setRestEnd(null);
    if (items[index]?.kind === "recovery" && index < items.length - 1) go(index + 1);
  }, [now, restEnd, index, items, go]);
  // L'écran reste allumé pendant la séance, quand le navigateur le permet.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = () =>
      (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<typeof lock> } }).wakeLock
        ?.request("screen")
        .then((granted) => (lock = granted))
        .catch(() => undefined);
    void request();
    const again = () => (document.visibilityState === "visible" ? void request() : undefined);
    document.addEventListener("visibilitychange", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      void lock?.release().catch(() => undefined);
    };
  }, []);
  // Chaque étape annonce son titre ; une récupération démarre seule.
  useEffect(() => {
    heading.current?.focus();
    const step = items[index];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- démarrage voulu à l'arrivée sur l'étape
    if (step?.kind === "recovery") startRest(step.prescription.duration_s);
  }, [index, items]);
  const unlockSound = () => {
    if (audio.current) return;
    try {
      audio.current = new AudioContext();
    } catch {
      audio.current = null;
    }
  };

  const item = items[index];
  const sets = Object.entries(checked)
    .filter(([, done]) => done)
    .map(([key]) => {
      const [itemRef, setIndex] = key.split("#");
      return { itemRef: itemRef as string, setIndex: Number(setIndex), done: true };
    });

  if (!item) {
    return (
      <main className="scene-dark flex min-h-dvh flex-col items-start gap-4 bg-ink p-4 text-fg">
        <p>{m.today.empty}</p>
        <Button variant="darkSecondary" onClick={() => router.back()}>
          {m.common.back}
        </Button>
      </main>
    );
  }
  const recovery = item.kind === "recovery";
  const restDuration = recovery ? item.prescription.duration_s : item.prescription.rest_s;
  const setCount = item.prescription.sets ?? 1;
  const doneCount = Array.from({ length: setCount }, (_, i) => checked[`${item.ref}#${i}`]).filter(Boolean).length;
  const last = index === items.length - 1;
  return (
    <main className="scene-dark min-h-dvh bg-ink text-fg">
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
            <span className="t-caption font-normal text-soft">{m.builder.sequence.stage(index + 1, items.length)}</span>
            <div
              role="progressbar"
              aria-label={m.sessionMode.progress(index + 1, items.length)}
              aria-valuemin={1}
              aria-valuemax={items.length}
              aria-valuenow={index + 1}
              className="h-1 overflow-hidden rounded-sm bg-card-line"
            >
              <span className="block h-full bg-accent" style={{ width: `${((index + 1) / items.length) * 100}%` }} />
            </div>
          </div>
        </div>

        {item.rounds?.length ? (
          <p className="text-soft">
            {item.rounds.map((r) => m.builder.sequence.round(r.name, r.round, r.rounds)).join(" · ")}
          </p>
        ) : null}
        <h1 ref={heading} tabIndex={-1} className="t-display outline-none">
          {item.name}
        </h1>

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
                  speed === s ? "bg-accent text-on-accent" : "border border-control-line text-fg",
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

        {item.guide ? <MovementGuideDisclosure guide={item.guide} /> : null}

        {!recovery ? (
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
                      unlockSound();
                      setChecked({ ...checked, [key]: !done });
                      if (done) return;
                      const lastSet = doneCount + 1 >= setCount;
                      const seconds = lastSet
                        ? (item.restAfterLastSetS ?? item.prescription.rest_s)
                        : item.prescription.rest_s;
                      // Dernière série sans repos : l'étape suivante vient d'elle-même, comme dans un circuit.
                      if (lastSet && !seconds && !last) setTimeout(() => go(index + 1), 600);
                      else startRest(seconds);
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
        ) : null}

        {restDuration ? (
          <div className="flex items-center gap-3 rounded-card bg-card-raised py-2.5 pl-4 pr-2.5">
            <Timer aria-hidden className="size-5 shrink-0 text-link" />
            <span className="flex-1">{recovery ? m.builder.sequenceRecovery : m.sessionMode.rest}</span>
            <span role="timer" className="t-num text-[22px]">
              {formatDuration(restLeft ?? restDuration)}
            </span>
            <button
              type="button"
              onClick={() => {
                unlockSound();
                if (restLeft === null) startRest(restDuration);
                else setRestEnd(null);
              }}
              className="min-h-11 rounded-full bg-accent px-4 font-semibold text-on-accent"
            >
              {restLeft === null ? m.sessionMode.startRest : m.sessionMode.stopRest}
            </button>
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
        {!last && items[index + 1] ? (
          <p className="text-soft">
            {m.sessionMode.upNext(
              [items[index + 1]!.name, ...(items[index + 1]!.rounds ?? []).map((r) => `${r.round}/${r.rounds}`)].join(" · "),
            )}
          </p>
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
              onClick={() => go(index - 1)}
            >
              {m.sessionMode.previous}
            </Button>
            {!last ? (
              <Button
                size="lg"
                variant="darkPrimary"
                className="flex-[2]"
                onClick={() => go(index + 1)}
              >
                {m.builder.sequence.next}
                <ArrowRight aria-hidden className="size-5" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
};
