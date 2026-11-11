"use client";

import { m } from "@tartan/i18n";
import { phaseAt, type EventId } from "@tartan/mascot/event";
import { CLIPS } from "@tartan/mascot/events";
import { Pause, Play } from "lucide-react";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { EventScene } from "@/components/event-scene";
import { Button } from "@/components/ui/button";

const REDUCED = "(prefers-reduced-motion: reduce)";
const watchMotion = (notify: () => void) => {
  const query = matchMedia(REDUCED);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const useReducedMotion = () =>
  useSyncExternalStore(
    watchMotion,
    () => matchMedia(REDUCED).matches,
    () => false,
  );

// Le geste reste sur sa dernière image un instant, puis repart du début.
const HOLD = 0.18;

// Un geste à relire : une image fixe par défaut, la lecture à la demande, et un curseur pour s'arrêter où l'on veut.
export const GesturePlayer = ({ id }: { id: EventId }) => {
  const clip = CLIPS[id];
  const [time, setTime] = useState(clip.still);
  const [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();
  const running = playing && !reduced;
  const slider = useId();

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const elapsed = now - last;
      last = now;
      setTime((current) => {
        const next = current + elapsed / clip.duration;
        return next > 1 + HOLD ? 0 : next;
      });
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, clip.duration]);

  const at = Math.min(1, time);
  const name = m.group.athletes[id];
  const event = m.group.events[id];
  const phase = m.group.phases[phaseAt(clip, at).name];

  return (
    <div className="flex flex-col gap-3">
      {/* Sur téléphone, le cadre suit l'athlète ; plus large, la scène entière tient à l'écran. */}
      <EventScene
        id={id}
        t={at}
        focus={400}
        role="img"
        aria-label={m.group.gesture(name, event, phase)}
        className="w-full rounded-button tablet:hidden"
        data-gesture={id}
      />
      <EventScene
        id={id}
        t={at}
        role="img"
        aria-label={m.group.gesture(name, event, phase)}
        className="hidden w-full rounded-button tablet:block"
        data-gesture={id}
      />
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2">
        {reduced ? null : (
          <Button
            size="sm"
            variant="secondary"
            aria-label={running ? m.admin.mascot.pauseLabel(event) : m.admin.mascot.playLabel(event)}
            onClick={() => {
              // Arrêté sur la dernière image, le geste repart du début.
              if (!running && time >= 1) setTime(0);
              setPlaying(!running);
            }}
          >
            {running ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
            {running ? m.admin.mascot.pause : m.admin.mascot.play}
          </Button>
        )}
        <label htmlFor={slider} className="sr-only">
          {m.admin.mascot.scrub(event)}
        </label>
        <input
          id={slider}
          type="range"
          min={0}
          max={1}
          step={0.005}
          value={at}
          aria-valuetext={phase}
          onChange={(change) => {
            setPlaying(false);
            setTime(Number(change.target.value));
          }}
          className="h-11 min-w-32 flex-1 accent-link"
        />
        <p aria-hidden className="t-caption w-full text-soft tablet:w-36 tablet:text-right">
          {phase}
        </p>
      </div>
      {reduced ? <p className="t-caption text-soft">{m.admin.mascot.reducedMotion}</p> : null}
    </div>
  );
};
