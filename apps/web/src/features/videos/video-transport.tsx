"use client";

import { formatTimecode } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Pause, Play, Repeat, SkipBack, SkipForward } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export const SPEEDS = [0.1, 0.25, 0.5, 1];
export const speedLabel = (s: number) => `${String(s).replace(".", ",")}×`;

export type Loop = { a: number; b: number | null } | null;

// Les contrôles sous l'image : image par image, lecture, temps, vitesse, boucle.
// `compact` : sur un téléphone en plein écran, tout tient sur une ligne ; la vitesse change d'un toucher.
export const VideoTransport = ({
  playing,
  timeMs,
  speed,
  loop,
  compact,
  className,
  onToggle,
  onStep,
  onSpeed,
  onLoop,
}: {
  playing: boolean;
  timeMs: number;
  speed: number;
  loop: Loop;
  compact: boolean;
  className?: string;
  onToggle: () => void;
  onStep: (direction: -1 | 1) => void;
  onSpeed: (speed: number) => void;
  onLoop: () => void;
}) => {
  const loopLabel = !loop
    ? m.videoCollaboration.loopStart
    : loop.b === null
      ? m.videoCollaboration.loopEnd
      : m.videoCollaboration.loopRemove;
  const nextSpeed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!;
  return (
    <div className={cn("flex items-center", compact ? "justify-between gap-1" : "flex-wrap gap-2", className)}>
      <div className={cn("flex items-center", compact ? "gap-1" : "gap-2")}>
        <IconButton tone="dark" label={m.video.previousFrame} aria-keyshortcuts="ArrowLeft" onClick={() => onStep(-1)}>
          <SkipBack aria-hidden className="size-5" />
        </IconButton>
        <button
          type="button"
          aria-label={playing ? m.video.pause : m.video.play}
          aria-keyshortcuts="Space"
          onClick={onToggle}
          className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent"
        >
          {playing ? <Pause aria-hidden className="size-5" /> : <Play aria-hidden className="size-5" />}
        </button>
        <IconButton tone="dark" label={m.video.nextFrame} aria-keyshortcuts="ArrowRight" onClick={() => onStep(1)}>
          <SkipForward aria-hidden className="size-5" />
        </IconButton>
        <span className="t-num min-w-16 text-[20px]">{formatTimecode(timeMs)}</span>
      </div>
      {compact ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={w.video.speedNext(speedLabel(speed), speedLabel(nextSpeed))}
            onClick={() => onSpeed(nextSpeed)}
            className="t-num min-h-11 min-w-14 rounded-button bg-card-raised px-2 text-[16px] text-fg"
          >
            {speedLabel(speed)}
          </button>
          <IconButton
            tone="dark"
            label={loopLabel}
            aria-pressed={loop !== null}
            onClick={onLoop}
            className={cn(loop && "bg-accent text-on-accent hover:bg-accent")}
          >
            <Repeat aria-hidden className="size-5" />
          </IconButton>
        </div>
      ) : (
        <>
          <div role="group" aria-label={m.videoCollaboration.playbackSpeed} className="flex gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={speed === s}
                onClick={() => onSpeed(s)}
                className={cn(
                  "min-h-11 min-w-11 rounded-button px-2 text-[14px] font-semibold",
                  speed === s ? "bg-accent text-on-accent" : "bg-card-raised text-fg",
                )}
              >
                {speedLabel(s)}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={loop !== null}
            onClick={onLoop}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-button px-3 text-[14px] font-semibold",
              loop ? "bg-accent text-on-accent" : "bg-card-raised text-fg",
            )}
          >
            <Repeat aria-hidden className="size-4" />
            {loopLabel}
          </button>
        </>
      )}
    </div>
  );
};
