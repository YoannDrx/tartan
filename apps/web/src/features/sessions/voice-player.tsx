"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";

export function VoicePlayer({
  src,
  label,
  durationSeconds,
}: {
  src: string;
  label: string;
  durationSeconds?: number | null;
}) {
  const player = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState<number | null>(durationSeconds ?? null);

  useEffect(() => {
    const audio = player.current;
    return () => audio?.pause();
  }, [src]);

  function readDuration(audio: HTMLAudioElement) {
    if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
  }
  async function toggle() {
    const audio = player.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    for (const other of document.querySelectorAll<HTMLAudioElement>("audio[data-session-voice]")) {
      if (other !== audio && !other.paused) other.pause();
    }
    if (failed) audio.load();
    setFailed(false);
    try {
      await audio.play();
    } catch {
      setFailed(true);
    }
  }
  const shownDuration = duration ?? durationSeconds;
  return (
    <div className="grid min-w-0 gap-1">
      <audio
        data-session-voice
        ref={player}
        src={src}
        preload={durationSeconds ? "none" : "metadata"}
        onLoadedMetadata={(event) => readDuration(event.currentTarget)}
        onDurationChange={(event) => readDuration(event.currentTarget)}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={(event) => {
          setPlaying(false);
          if (!shownDuration) setDuration(event.currentTarget.currentTime);
          setElapsed(0);
        }}
        onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
        onError={() => {
          setPlaying(false);
          setFailed(true);
        }}
      />
      <div className="flex min-w-0 items-center gap-2">
        <Button
          size="md"
          variant="secondary"
          className="min-w-12 shrink-0 px-3"
          onClick={() => void toggle()}
          aria-label={`${playing ? m.sessionThread.pause : m.sessionThread.play} · ${label}`}
        >
          {playing ? (
            <Pause aria-hidden className="size-5 fill-current" />
          ) : (
            <Play aria-hidden className="size-5 fill-current" />
          )}
        </Button>
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
          <span className="break-words font-semibold">{label}</span>
          <span className="t-num whitespace-nowrap text-soft" aria-live="off">
            {elapsed > 0 ? m.sessionThread.duration(elapsed) : null}
            {elapsed > 0 && shownDuration ? " / " : null}
            {shownDuration ? m.sessionThread.duration(shownDuration) : null}
          </span>
        </div>
      </div>
      {failed ? (
        <p role="alert" className="t-caption">
          {m.sessionVoice.listenFailed}
        </p>
      ) : null}
    </div>
  );
}
