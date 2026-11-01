"use client";

import type { JumpPhase, VideoDetail } from "@tartan/contracts";
import { formatHeight, formatTimecode, frameStepMs, isHighFrameRate, phaseAt, phaseRanges } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Check, ChevronLeft, Pause, Play, Repeat, Share2, SkipBack, SkipForward, Trash2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconButton } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { CommentThread } from "@/features/comments/thread";
import { addAnnotationAction, deleteAnnotationAction, shareVideoAction } from "./video.action";

const SPEEDS = [0.1, 0.25, 0.5, 1];
const PHASES = Object.keys(m.jumpPhase) as JumpPhase[];
const speedLabel = (s: number) => `${String(s).replace(".", ",")}×`;

export const VideoAnalysis = ({
  video,
  canAnnotate,
  currentUserId,
  backHref,
  path,
}: {
  video: VideoDetail;
  canAnnotate: boolean;
  currentUserId: string;
  backHref: string;
  path: string;
}) => {
  const router = useRouter();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.25);
  const [timeMs, setTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(video.durationMs ?? 0);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<JumpPhase | "">("");
  const [loop, setLoop] = useState<{ a: number; b: number | null } | null>(null);
  const src = video.mp4Url ?? video.hlsUrl;

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    let hls: { destroy: () => void } | undefined;
    if (src.includes(".m3u8") && !el.canPlayType("application/vnd.apple.mpegurl")) {
      import("hls.js").then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const instance = new Hls();
          instance.loadSource(src);
          instance.attachMedia(el);
          hls = instance;
        }
      });
    } else {
      el.src = src;
    }
    return () => hls?.destroy();
  }, [src]);

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed;
  }, [speed]);

  // Suivi fin de la tête de lecture ; la boucle sur une portion se règle ici aussi.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const ms = el.currentTime * 1000;
        setTimeMs(ms);
        if (loop?.b != null && ms >= loop.b) el.currentTime = loop.a / 1000;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loop]);

  const step = useMemo(() => frameStepMs(video.fps), [video.fps]);
  const seek = (ms: number) => {
    const el = ref.current;
    if (!el) return;
    el.pause();
    setPlaying(false);
    el.currentTime = Math.max(0, Math.min(ms, durationMs)) / 1000;
    setTimeMs(el.currentTime * 1000);
  };
  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      el.playbackRate = speed;
      el.play().catch(() => toast.error("Lecture impossible sur cet appareil."));
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const ranges = useMemo(
    () =>
      phaseRanges(
        video.annotations.map((a) => ({ tMs: a.tMs, phase: a.phase })),
        durationMs,
      ),
    [video.annotations, durationMs],
  );
  const currentPhase = phaseAt(ranges, timeMs);

  const add = useAction(addAnnotationAction, {
    onSuccess: () => {
      setText("");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.errors.invalid),
  });
  const removeAnnotation = useAction(deleteAnnotationAction, { onSuccess: () => router.refresh() });
  const share = useAction(shareVideoAction, {
    onSuccess: ({ input }) => {
      toast.ok(
        input.withAthlete ? `${m.video.shared}. ${video.athleteName.split(" ")[0]} est prévenu.` : "Partage retiré.",
      );
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });

  const pct = (ms: number) => (durationMs > 0 ? (ms / durationMs) * 100 : 0);

  return (
    <div className="scene-dark min-h-dvh bg-ink text-white [&_a]:text-brand-on-ink">
      <div className="mx-auto grid max-w-[1200px] gap-4 p-4 desktop:grid-cols-[minmax(0,1fr)_360px] desktop:p-6">
        <div className="flex min-w-0 flex-col gap-3">
          <header className="flex items-center gap-3">
            <Link
              href={backHref}
              aria-label={m.common.back}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink-2 !text-white"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="t-h2 truncate">
                {video.athleteName}
                {video.attemptNo ? `, essai ${video.attemptNo}` : ""}
              </h1>
              <p className="t-caption font-normal text-muted-on-ink">
                {video.recordedAt
                  ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(
                      new Date(video.recordedAt),
                    )
                  : ""}
              </p>
            </div>
            {canAnnotate ? (
              <IconButton
                tone="darkRound"
                label={video.sharedWithAthlete ? m.video.unshare : m.video.share}
                aria-pressed={video.sharedWithAthlete}
                disabled={share.isPending}
                onClick={() => share.execute({ videoId: video.id, withAthlete: !video.sharedWithAthlete })}
              >
                {video.sharedWithAthlete ? (
                  <Check aria-hidden className="size-5" />
                ) : (
                  <Share2 aria-hidden className="size-4" />
                )}
              </IconButton>
            ) : null}
          </header>

          <div className="relative overflow-hidden rounded-block bg-black">
            {src ? (
              <video
                ref={ref}
                playsInline
                preload="auto"
                muted
                loop={loop === null}
                onLoadedMetadata={(e) => setDurationMs(e.currentTarget.duration * 1000)}
                onPause={() => setPlaying(false)}
                onPlay={() => setPlaying(true)}
                className="aspect-video w-full"
                aria-label={`Vidéo du saut de ${video.athleteName}`}
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center p-6 text-center text-muted-on-ink">
                {video.status === "error"
                  ? m.video.failed
                  : video.status === "ready"
                    ? "Lecture indisponible : la clé de signature Mux n'est pas configurée."
                    : video.status === "processing"
                      ? m.video.processing
                      : m.video.uploading}
              </div>
            )}
            {video.barHeightCm ? (
              <span className="absolute left-3 top-3 rounded-full bg-brand px-2.5 py-1 t-caption font-semibold">
                {formatHeight(video.barHeightCm)} m,{" "}
                {video.result === "O"
                  ? m.video.cleared.toLowerCase()
                  : video.result === "X"
                    ? m.video.failedJump.toLowerCase()
                    : m.video.passed.toLowerCase()}
              </span>
            ) : null}
            <span className="absolute right-3 top-3 rounded-full bg-ink-2 px-2.5 py-1 t-caption font-semibold">
              {speedLabel(speed)}
              {video.fps ? `, ${video.fps} i/s` : ""}
            </span>
          </div>
          {video.fps && !isHighFrameRate(video.fps) ? (
            <p className="t-caption font-normal text-muted-on-ink">{m.video.fpsLow}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <IconButton tone="dark" label={m.video.previousFrame} onClick={() => seek(timeMs - step)}>
              <SkipBack aria-hidden className="size-5" />
            </IconButton>
            <button
              type="button"
              aria-label={playing ? m.video.pause : m.video.play}
              onClick={toggle}
              className="inline-flex size-[52px] items-center justify-center rounded-full bg-white text-ink"
            >
              {playing ? <Pause aria-hidden className="size-5" /> : <Play aria-hidden className="size-5" />}
            </button>
            <IconButton tone="dark" label={m.video.nextFrame} onClick={() => seek(timeMs + step)}>
              <SkipForward aria-hidden className="size-5" />
            </IconButton>
            <span className="t-num min-w-16 text-[20px]">{formatTimecode(timeMs)}</span>
            <div role="group" aria-label="Vitesse de lecture" className="flex gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={speed === s}
                  onClick={() => setSpeed(s)}
                  className={cn(
                    "min-h-11 min-w-11 rounded-button px-2 text-[14px] font-semibold",
                    speed === s ? "bg-white text-ink" : "bg-ink-2 text-white",
                  )}
                >
                  {speedLabel(s)}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-pressed={loop !== null}
              onClick={() => {
                if (!loop) setLoop({ a: timeMs, b: null });
                else if (loop.b === null && timeMs > loop.a) setLoop({ a: loop.a, b: timeMs });
                else setLoop(null);
              }}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-button px-3 text-[14px] font-semibold",
                loop ? "bg-brand text-white" : "bg-ink-2 text-white",
              )}
            >
              <Repeat aria-hidden className="size-4" />
              {!loop ? "Boucle : début" : loop.b === null ? "Boucle : fin" : "Retirer la boucle"}
            </button>
          </div>

          {/* Timeline : segments par phase, repères de commentaires, tête de lecture blanche. */}
          <div className="flex flex-col gap-1">
            <label htmlFor="timeline" className="sr-only">
              Position dans la vidéo
            </label>
            <div className="relative h-9">
              <div className="absolute inset-x-0 top-3 flex h-2.5 gap-0.5 overflow-hidden rounded-[3px] bg-ink-3">
                {ranges.map((r, i) => (
                  <span
                    key={r.phase}
                    style={{ flexGrow: Math.max(r.endMs - r.startMs, 1) }}
                    className={cn(currentPhase === r.phase ? "bg-brand" : i % 2 ? "bg-[#4E5159]" : "bg-ink-3")}
                  />
                ))}
              </div>
              {video.annotations.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={`Aller à ${formatTimecode(a.tMs)}`}
                  onClick={() => seek(a.tMs)}
                  style={{ left: `${pct(a.tMs)}%` }}
                  className="absolute top-0 z-10 flex size-3 -translate-x-1/2 items-start justify-center before:absolute before:-inset-3 before:content-['']"
                >
                  <span className="size-2 rounded-full bg-brand-on-ink" />
                </button>
              ))}
              <span
                aria-hidden
                style={{ left: `${pct(timeMs)}%` }}
                className="absolute top-1 h-7 w-[3px] -translate-x-1/2 rounded-sm bg-white"
              />
              <input
                id="timeline"
                type="range"
                min={0}
                max={Math.max(durationMs, 1)}
                step={Math.max(step, 1)}
                value={Math.min(timeMs, durationMs)}
                onChange={(e) => seek(Number(e.target.value))}
                className="absolute inset-x-0 top-1 h-7 w-full cursor-pointer opacity-0"
              />
            </div>
            {ranges.length > 0 ? (
              <div className="flex gap-0.5 text-[12px] text-muted-on-ink">
                {ranges.map((r) => (
                  <span
                    key={r.phase}
                    style={{ flexGrow: Math.max(r.endMs - r.startMs, 1) }}
                    className={cn("min-w-0 truncate", currentPhase === r.phase && "font-semibold text-white")}
                  >
                    {m.jumpPhase[r.phase]}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          {video.barSheet.length > 0 ? (
            <section>
              <h2 className="t-section mb-2 text-muted-on-ink">{m.video.barSheet}</h2>
              <ul className="flex flex-wrap gap-1.5">
                {video.barSheet.map((r) => (
                  <li
                    key={r.heightCm}
                    className={cn(
                      "flex min-w-14 flex-1 flex-col items-center rounded-thumb px-2 py-1.5",
                      r.heightCm === video.barHeightCm ? "bg-brand" : "bg-ink-2",
                    )}
                  >
                    <span className="t-num text-[17px] leading-tight">{r.label}</span>
                    <span
                      className={cn("t-caption", r.heightCm === video.barHeightCm ? "text-white" : "text-muted-on-ink")}
                    >
                      {r.notation}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-label="Remarques sur la vidéo" className="flex flex-col gap-2">
            {video.annotations.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 rounded-card bg-ink-2 p-2.5">
                <button
                  type="button"
                  onClick={() => seek(a.tMs)}
                  className="t-caption inline-flex min-h-11 shrink-0 items-center rounded-full px-1 font-semibold text-brand-on-ink underline"
                >
                  {formatTimecode(a.tMs)}
                </button>
                <div className="min-w-0 flex-1 py-1.5">
                  {a.phase ? <p className="t-caption font-semibold text-muted-on-ink">{m.jumpPhase[a.phase]}</p> : null}
                  <p className="break-words">{a.text}</p>
                </div>
                {canAnnotate ? (
                  <IconButton
                    tone="dark"
                    label={m.common.delete}
                    onClick={() => removeAnnotation.execute({ id: a.id, videoId: video.id })}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </IconButton>
                ) : null}
              </div>
            ))}
            {canAnnotate ? (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (text.trim())
                    add.execute({ videoId: video.id, tMs: Math.round(timeMs), phase: phase || null, text });
                }}
              >
                <label htmlFor="annotation" className="sr-only">
                  {m.video.remarkAt(formatTimecode(timeMs))}
                </label>
                <input
                  id="annotation"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={m.video.remarkAt(formatTimecode(timeMs))}
                  className="min-h-11 w-full rounded-full border border-ink-3 bg-ink px-4 text-[16px] text-white placeholder:text-muted-on-ink"
                />
                <div className="flex gap-2">
                  <label htmlFor="phase" className="sr-only">
                    Phase du saut
                  </label>
                  <select
                    id="phase"
                    value={phase}
                    onChange={(e) => setPhase(e.target.value as JumpPhase | "")}
                    className="min-h-11 flex-1 rounded-button border border-ink-3 bg-ink px-2 text-white"
                  >
                    <option value="">Sans phase</option>
                    {PHASES.map((p) => (
                      <option key={p} value={p}>
                        {m.jumpPhase[p]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={add.isPending || !text.trim()}
                    className="min-h-11 rounded-full bg-brand px-4 font-semibold text-white disabled:opacity-50"
                  >
                    {m.video.addComment}
                  </button>
                </div>
              </form>
            ) : null}
          </section>

          <CommentThread
            entityType="video"
            entityId={video.id}
            comments={video.comments}
            currentUserId={currentUserId}
            path={path}
            dark
          />
        </aside>
      </div>
    </div>
  );
};
