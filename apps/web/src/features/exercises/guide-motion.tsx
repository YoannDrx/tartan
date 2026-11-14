"use client";

import type { ExerciseGuide } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { positionAt, type ExerciseClip } from "@tartan/mascot/exercise";
import { exerciseClip } from "@tartan/mascot/exercises";
import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { ExerciseScene } from "@/components/exercise-scene";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const t = m.exerciseGuide.motion;

// Le geste du guide : il tourne en boucle, une pastille par ligne du guide montre où il en est, et la ligne
// en cours s'affiche dessous. Arrêté, on choisit la position à regarder. En mouvement réduit : la frise des positions.
// Le geste se retrouve ici, côté client, d'après la clé du catalogue : une page serveur ne transmet que le guide.
export const GuideMotion = ({ guide, autoPlay = true }: { guide: ExerciseGuide; autoPlay?: boolean }) => {
  const clip = exerciseClip(guide.catalogKey);
  return clip ? <Player guide={guide} clip={clip} autoPlay={autoPlay} /> : null;
};

const Player = ({ guide, clip, autoPlay }: { guide: ExerciseGuide; clip: ExerciseClip; autoPlay: boolean }) => {
  const reduced = useReducedMotion();
  const [time, setTime] = useState(clip.stills[0]!);
  const [playing, setPlaying] = useState(autoPlay);
  const running = playing && !reduced;
  const lines = guide.illustration.positions;

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const elapsed = now - last;
      last = now;
      setTime((current) => (current + elapsed / clip.duration) % 1);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, clip.duration]);

  const caption =
    guide.illustration.motion === "approved" ? m.exerciseGuide.original : m.exerciseGuide.illustrationPending;

  if (reduced)
    return (
      <figure className="flex min-w-0 flex-col gap-2">
        <ol aria-label={t.positions} className="grid grid-cols-2 gap-2 desktop:grid-cols-4">
          {clip.stills.map((still, index) => (
            <li key={index} className="flex min-w-0 flex-col gap-1">
              <ExerciseScene gesture={clip} t={still} role="img" aria-label={lines[index] ?? guide.illustration.alt} className="w-full rounded-button" />
              <span className="t-caption text-soft">{t.position(index)}</span>
            </li>
          ))}
        </ol>
        <figcaption className="t-caption text-soft">
          {t.reduced} {caption}
        </figcaption>
      </figure>
    );

  const current = positionAt(clip, time);
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <ExerciseScene gesture={clip} t={time} role="img" aria-label={guide.illustration.alt} className="w-full rounded-button" />
      <div className="flex min-h-11 flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          aria-label={running ? t.pause : t.play}
          onClick={() => setPlaying(!running)}
        >
          {running ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
        </Button>
        <div role="group" aria-label={t.positions} className="flex gap-1">
          {clip.stills.map((still, index) => (
            <button
              key={index}
              type="button"
              aria-label={t.show(t.position(index))}
              aria-pressed={!running && current === index}
              onClick={() => {
                setPlaying(false);
                setTime(still);
              }}
              className={cn(
                "t-num grid size-11 place-items-center rounded-button border border-card-line text-sm",
                current === index && "border-transparent bg-accent text-on-accent",
              )}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
      {/* Lue seulement une fois le geste arrêté : en lecture, la ligne change toutes les secondes. */}
      <p aria-live={running ? "off" : "polite"} className="min-h-12">
        <span className="font-semibold">{t.position(current)} : </span>
        {lines[current]}
      </p>
      <figcaption className="t-caption text-soft">{caption}</figcaption>
    </figure>
  );
};
