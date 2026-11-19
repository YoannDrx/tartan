"use client";

import { JUMP_PHASES, MOVEMENT_PHASES, type JumpPhase, type VideoDetail } from "@tartan/contracts";
import {
  formatHeight,
  hasHighJumpContext,
  formatTimecode,
  frameStepMs,
  isHighFrameRate,
  phaseAt,
  phaseRanges,
  toFileSeconds,
  toRealMs,
  drawingPoints,
  type DrawingKind,
  type DrawingPoint,
} from "@tartan/domain";
import { m, withFirstOfMonth } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Check, ChevronLeft, Flag, Maximize, Minimize, Share2, Trash2, Download } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { BarSheet } from "@/components/bar-sheet";
import { Avatar } from "@/components/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { CheckRow, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { reportContentAction } from "@/features/comments/comment.action";
import { CommentThread } from "@/features/comments/thread";
import { growSheet, sheetForRemark, shortcutFor, shrinkSheet, type SheetHeight } from "./immersive-layout";
import { RefreshWhilePending } from "./refresh-while-pending";
import { groupMarkers } from "./timeline-markers";
import { useImmersive } from "./use-immersive";
import { VideoCollaborationTools } from "./video-collaboration-tools";
import { VideoExerciseLink } from "./video-exercise-link";
import { addAnnotationAction, deleteAnnotationAction, shareVideoAction } from "./video.action";
import { DrawingLayer, DrawingTools, describeDrawing } from "./video-drawing";
import { PanelHeader, SheetHeader, ShortcutsHelp } from "./video-editor-chrome";
import { VideoTransport, speedLabel, type Loop } from "./video-transport";

// Un tracé s'affiche autour de l'instant de sa remarque.
const DRAWING_WINDOW_MS = 400;

// Sous ces hauteurs visibles (téléphone en paysage, clavier ouvert), l'image passe avant le titre, puis avant les
// contrôles : l'instant commenté n'est jamais masqué.
const SHORT_VIEWPORT = 560;
const TINY_VIEWPORT = 300;

// Les phases du saut avec les outils de hauteur, sinon les trois phases d'un geste quelconque.
const phasesFor = (jump: boolean): readonly JumpPhase[] => (jump ? JUMP_PHASES : MOVEMENT_PHASES);

export const VideoAnalysis = ({
  video,
  canAnnotate,
  staff = true,
  currentUserId,
  backHref,
  path,
  exercises = [],
}: {
  video: VideoDetail;
  canAnnotate: boolean;
  staff?: boolean;
  currentUserId: string;
  backHref: string;
  path: string;
  exercises?: { id: string; name: string }[];
}) => {
  const router = useRouter();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.25);
  const [timeMs, setTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(video.durationMs ?? 0);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<VideoDetail["annotations"][number] | null>(null);
  const [jumpTools, setJumpTools] = useState<boolean | null>(null);
  const showJumpTools = jumpTools ?? hasHighJumpContext(video);
  const [phase, setPhase] = useState<JumpPhase | "">("");
  // Le tracé en cours : un outil, les points déjà posés, et la taille réelle de l'image pour le cadrage.
  const [tool, setTool] = useState<DrawingKind | null>(null);
  const [draft, setDraft] = useState<DrawingPoint[]>([]);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [loop, setLoop] = useState<Loop>(null);
  // Le plein écran : l'éditeur reste à portée, en panneau à droite (paysage, écran large) ou en feuille en bas.
  const immersive = useImmersive();
  const full = immersive.on;
  const sheetLayout = full && !immersive.side;
  const sideLayout = full && immersive.side;
  const [sheet, setSheet] = useState<SheetHeight>("rail");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [wide, setWide] = useState(false);
  const editorHidden = sheetLayout ? sheet === "rail" && dragHeight === null : sideLayout && collapsed;
  const stageHidden = sheetLayout && sheet === "full";
  const visibleHeight = full ? (immersive.viewport?.height ?? null) : null;
  const short = visibleHeight !== null && visibleHeight < SHORT_VIEWPORT;
  const tiny = visibleHeight !== null && visibleHeight < TINY_VIEWPORT;
  const layerRef = useRef<SVGSVGElement>(null);
  const drawingHelpId = useId();
  // Mux génère le MP4 après l'encodage : en attendant, le flux HLS prend le relais.
  const [mp4Failed, setMp4Failed] = useState(false);
  const src = mp4Failed ? video.hlsUrl : (video.mp4Url ?? video.hlsUrl);
  // Le fichier est étiré : tout l'écran raisonne en temps réel, seul l'élément vidéo voit le temps du fichier.
  const scale = video.timeScale;

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    let hls: { destroy: () => void } | undefined;
    let cancelled = false;
    if (src.includes(".m3u8") && !el.canPlayType("application/vnd.apple.mpegurl")) {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (cancelled || !Hls.isSupported()) return;
          const instance = new Hls();
          instance.loadSource(src);
          instance.attachMedia(el);
          hls = instance;
        })
        .catch(() => toast.error(m.video.playbackUnavailable));
    } else {
      el.src = src;
    }
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src]);

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed * scale;
  }, [speed, scale]);

  // Suivi fin de la tête de lecture ; la boucle sur une portion se règle ici aussi.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const ms = toRealMs(el.currentTime, scale);
        setTimeMs(ms);
        if (loop?.b != null && ms >= loop.b) el.currentTime = toFileSeconds(loop.a, scale);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loop, scale]);

  const step = useMemo(() => frameStepMs(video.fps), [video.fps]);
  const seek = (ms: number) => {
    const el = ref.current;
    if (!el) return;
    el.pause();
    setPlaying(false);
    el.currentTime = toFileSeconds(Math.max(0, Math.min(ms, durationMs)), scale);
    setTimeMs(toRealMs(el.currentTime, scale));
  };
  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      el.playbackRate = speed * scale;
      el.play().catch(() => toast.error(w.video.playbackImpossible));
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };
  // Le pas part de la position réelle de l'élément : une touche tenue avance d'une image à chaque répétition.
  const stepBy = (direction: -1 | 1) => {
    const el = ref.current;
    if (el) seek(toRealMs(el.currentTime, scale) + direction * step);
  };
  const cycleLoop = () => {
    if (!loop) setLoop({ a: timeMs, b: null });
    else if (loop.b === null && timeMs > loop.a) setLoop({ a: loop.a, b: timeMs });
    else setLoop(null);
  };

  // Écrire une remarque : la feuille s'ouvre à moitié, jamais plus, pour laisser visible l'image commentée.
  const focusComposer = () => {
    if (full)
      flushSync(() => {
        setSheet(sheetForRemark);
        setCollapsed(false);
      });
    document.getElementById("annotation")?.focus();
  };
  const addRemark = () => {
    ref.current?.pause();
    setPlaying(false);
    focusComposer();
  };
  const clearDrawing = () => {
    setTool(null);
    setDraft([]);
  };
  // On entre en plein écran pour l'image : la feuille part repliée, le panneau ouvert.
  const toggleImmersive = () => {
    if (full) return immersive.exit();
    setSheet("rail");
    setCollapsed(false);
    immersive.enter();
  };

  // Raccourcis : espace, flèches, F et M. Ils se taisent dans un champ, dans un dialogue et sur le calque de tracé.
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
    const field = target?.closest("input, textarea, select, [contenteditable='true']");
    const passive = field instanceof HTMLInputElement && ["range", "checkbox"].includes(field.type);
    const action = shortcutFor({
      key: event.key,
      repeat: event.repeat,
      modified: event.ctrlKey || event.metaKey || event.altKey,
      typing: Boolean(field) && !passive,
      control: Boolean(target?.closest("button, a[href], summary, select, [role='button'], input[type='checkbox']")),
      dialog: Boolean(target?.closest("[role='dialog'], [role='alertdialog']")),
    });
    if (!action) return;
    if (action === "exit") {
      if (!full) return;
      immersive.exit();
    } else if (action === "remark") {
      if (!canAnnotate) return;
      addRemark();
    } else if (!src) return;
    else if (action === "fullscreen") toggleImmersive();
    else if (action === "toggle") toggle();
    else stepBy(action === "next" ? 1 : -1);
    event.preventDefault();
  });
  useEffect(() => {
    const listen = (event: KeyboardEvent) => onShortcut(event);
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, []);

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
      setReplyTo(null);
      clearDrawing();
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.errors.invalid),
  });
  const removeAnnotation = useAction(deleteAnnotationAction, { onSuccess: () => router.refresh() });
  const share = useAction(shareVideoAction, {
    onSuccess: ({ input }) => {
      toast.ok(
        input.withAthlete
          ? m.videoCollaboration.notified(video.athleteName.split(" ")[0] ?? video.athleteName)
          : m.videoCollaboration.unshared,
      );
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });

  const report = useAction(reportContentAction, {
    onSuccess: () => toast.ok(m.video.reported),
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });

  const pct = (ms: number) => (durationMs > 0 ? (ms / durationMs) * 100 : 0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(0);
  useEffect(() => {
    const element = timelineRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setTimelineWidth(element.offsetWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const markers = useMemo(
    () => groupMarkers(video.annotations, durationMs, timelineWidth),
    [video.annotations, durationMs, timelineWidth],
  );

  const drawingReady = Boolean(tool) && draft.length === drawingPoints(tool!);
  // En plein écran, la surcouche suit la partie visible de la fenêtre ; `--ih` en donne la hauteur à la feuille.
  const overlay = full
    ? ({
        top: immersive.viewport?.top ?? 0,
        height: immersive.viewport ? `${immersive.viewport.height}px` : "100dvh",
        "--ih": immersive.viewport ? `${immersive.viewport.height}px` : "100dvh",
      } as CSSProperties)
    : undefined;

  return (
    <div
      data-immersive={full ? (sideLayout ? "side" : "sheet") : undefined}
      style={overlay}
      className={cn(
        "scene-dark bg-ink text-fg [&_a]:text-link",
        full
          ? "fixed inset-x-0 z-30 overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]"
          : "min-h-dvh",
        sheetLayout && "flex flex-col",
        sideLayout && "grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)]",
      )}
    >
      <div
        className={
          full
            ? "contents"
            : "mx-auto grid max-w-[1200px] gap-4 p-4 desktop:grid-cols-[minmax(0,1fr)_360px] desktop:p-6"
        }
      >
        {/* Sous 1024 px, la colonne se défait : l'image, enfant direct de la page, reste collée en haut. */}
        <div className={full ? "contents" : "flex min-w-0 flex-col gap-3 max-desktop:contents"}>
          <header
            className={cn(
              "flex items-center gap-3",
              full && "min-h-12 shrink-0 px-3",
              sideLayout && "col-start-1 row-start-1",
              short && "hidden",
            )}
          >
            {full ? null : (
              <Link
                href={backHref}
                aria-label={m.common.back}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-card-raised !text-white"
              >
                <ChevronLeft aria-hidden className="size-5" />
              </Link>
            )}
            <div className="min-w-0 flex-1">
              <h1 className={cn("truncate", full ? "t-section" : "t-h2")}>
                {video.athleteName}
                {video.attemptNo ? m.videoCollaboration.attemptNumber(video.attemptNo) : ""}
              </h1>
              <p className={cn("t-caption font-normal text-soft", full && "hidden")}>
                {video.recordedAt
                  ? withFirstOfMonth(
                      new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(
                        new Date(video.recordedAt),
                      ),
                    )
                  : ""}
                {video.exerciseName && !canAnnotate ? `, ${video.exerciseName}` : ""}
              </p>
            </div>
            {src ? <ShortcutsHelp className="hidden tablet:inline-flex" /> : null}
            {full ? null : (
              <>
                <IconButton
                  tone="darkRound"
                  label={m.video.report}
                  disabled={report.isPending}
                  onClick={() => report.execute({ entityType: "video", entityId: video.id, reason: "inappropriate" })}
                >
                  <Flag aria-hidden className="size-4" />
                </IconButton>
                {staff && (video.canHideFromAthlete ?? true) ? (
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
                {video.mp4Url ? (
                  <a
                    href={video.mp4Url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 font-semibold"
                  >
                    <Download aria-hidden className="size-5" />
                    {m.video.download}
                  </a>
                ) : null}
              </>
            )}
          </header>

          {/* Le partage, la relecture et le mouvement lié se règlent hors plein écran. */}
          <div className={full ? "hidden" : "contents"}>
            <VideoCollaborationTools video={video} staff={staff} backHref={backHref} />
            {video.canManage && exercises.length > 0 ? (
              <VideoExerciseLink videoId={video.id} current={video.exerciseId ?? null} exercises={exercises} />
            ) : null}
          </div>

          {/* La scène : l'image, puis les contrôles et la frise dessous. */}
          <div
            className={cn(
              full ? "flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden" : "contents",
              sheetLayout && "flex-1 transition-[visibility] duration-(--duration-enter)",
              sideLayout && "col-start-1 row-start-2",
              stageHidden && "invisible",
            )}
          >
            <div
              className={
                full
                  ? "min-h-0 flex-1"
                  : "max-desktop:sticky max-desktop:top-0 max-desktop:z-20 max-desktop:-my-2 max-desktop:bg-ink max-desktop:py-2"
              }
            >
              <div className={cn("relative overflow-hidden bg-ink", full ? "h-full" : "rounded-card")}>
                {src ? (
                  <video
                    ref={ref}
                    playsInline
                    preload="auto"
                    muted
                    loop={loop === null}
                    onError={() => {
                      if (!mp4Failed && video.mp4Url && video.hlsUrl) setMp4Failed(true);
                    }}
                    onLoadedMetadata={(e) => {
                      setDurationMs(toRealMs(e.currentTarget.duration, scale));
                      setFrame({ width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight });
                    }}
                    onPause={() => setPlaying(false)}
                    onPlay={() => setPlaying(true)}
                    className={full ? "size-full" : "aspect-video w-full max-desktop:max-h-[45dvh]"}
                    aria-label={m.video.videoOf(video.athleteName)}
                  />
                ) : (
                  <div
                    className={cn(
                      "flex w-full items-center justify-center p-6 text-center text-soft",
                      full ? "h-full" : "aspect-video max-desktop:max-h-[45dvh]",
                    )}
                  >
                    {video.status === "uploading" || video.status === "processing" ? <RefreshWhilePending /> : null}
                    {video.consentRevoked
                      ? m.video.consentRevoked
                      : video.status === "error"
                        ? m.video.failed
                        : video.status === "ready"
                          ? m.video.playbackUnavailable
                          : video.status === "processing"
                            ? m.video.processing
                            : m.video.uploading}
                  </div>
                )}
                {src ? (
                  <DrawingLayer
                    // Un nouvel outil repart d'un calque neuf : le repère du clavier revient au centre de l'image.
                    key={tool ?? "none"}
                    ref={layerRef}
                    width={frame.width}
                    height={frame.height}
                    drawings={video.annotations.flatMap((a) =>
                      a.drawing && Math.abs(a.tMs - timeMs) <= DRAWING_WINDOW_MS ? [a.drawing] : [],
                    )}
                    draft={tool ? draft : []}
                    tool={tool}
                    describedBy={drawingHelpId}
                    onDraft={setDraft}
                    onValidate={focusComposer}
                    onCancel={() => {
                      const kind = tool;
                      clearDrawing();
                      document.querySelector<HTMLElement>(`[data-drawing-tool="${kind}"]`)?.focus();
                    }}
                  />
                ) : null}
                {video.barHeightCm ? (
                  <span className="absolute left-3 top-3 rounded-full bg-brand px-2.5 py-1 t-caption font-semibold">
                    {w.video.barBadge(
                      formatHeight(video.barHeightCm),
                      (video.result === "O"
                        ? m.video.cleared
                        : video.result === "X"
                          ? m.video.failedJump
                          : m.video.passed
                      ).toLowerCase(),
                    )}
                  </span>
                ) : null}
                <span className="absolute right-3 top-3 rounded-full bg-card-raised px-2.5 py-1 t-caption font-semibold">
                  {w.video.speedBadge(speedLabel(speed), video.fps)}
                </span>
                {src ? (
                  <IconButton
                    tone="darkRound"
                    label={full ? w.video.fullscreen.exit : w.video.fullscreen.enter}
                    aria-keyshortcuts="F"
                    onClick={toggleImmersive}
                    className="absolute bottom-3 right-3"
                  >
                    {full ? <Minimize aria-hidden className="size-5" /> : <Maximize aria-hidden className="size-5" />}
                  </IconButton>
                ) : null}
              </div>
            </div>
            {video.fps && !isHighFrameRate(video.fps) ? (
              <p className={cn("t-caption font-normal text-soft", full && "hidden")}>{m.video.fpsLow}</p>
            ) : null}

            <VideoTransport
              playing={playing}
              timeMs={timeMs}
              speed={speed}
              loop={loop}
              // Sur un téléphone, en portrait comme en paysage, les contrôles tiennent sur une ligne.
              compact={sheetLayout || (sideLayout && short)}
              className={cn(full && "shrink-0 px-3", tiny && "hidden")}
              onToggle={toggle}
              onStep={stepBy}
              onSpeed={setSpeed}
              onLoop={cycleLoop}
            />

            {/* Timeline : segments par phase, repères de commentaires, tête de lecture blanche. */}
            <div className={cn("flex flex-col gap-1", full && "shrink-0 px-3 pb-2", tiny && "hidden")}>
              <label htmlFor="timeline" className="sr-only">
                {w.video.timelinePosition}
              </label>
              <div ref={timelineRef} className="relative h-9">
                <div className="absolute inset-x-0 top-3 flex h-2.5 gap-0.5 overflow-hidden rounded-[3px] bg-card-line">
                  {ranges.map((r, i) => (
                    <span
                      key={r.phase}
                      style={{ flexGrow: Math.max(r.endMs - r.startMs, 1) }}
                      className={cn(
                        currentPhase === r.phase ? "bg-accent" : i % 2 ? "bg-control-line" : "bg-card-line",
                      )}
                    />
                  ))}
                </div>
                {markers.map(({ first, count }) => (
                  <button
                    key={first.id}
                    type="button"
                    aria-label={w.video.goTo(formatTimecode(first.tMs), count)}
                    onClick={() => seek(first.tMs)}
                    style={{ left: `${pct(first.tMs)}%` }}
                    className="absolute -top-1 z-10 flex size-6 -translate-x-1/2 items-start justify-center pt-1"
                  >
                    <span className="size-2 rounded-full bg-accent" />
                  </button>
                ))}
                <span
                  aria-hidden
                  style={{ left: `${pct(timeMs)}%` }}
                  className="absolute top-1 h-7 w-[3px] -translate-x-1/2 rounded-sm bg-fg"
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
                <div className="flex gap-0.5 text-[12px] text-soft">
                  {ranges.map((r) => (
                    <span
                      key={r.phase}
                      style={{ flexGrow: Math.max(r.endMs - r.startMs, 1) }}
                      className={cn("min-w-0 truncate", currentPhase === r.phase && "font-semibold text-fg")}
                    >
                      {m.jumpPhase[r.phase]}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* L'éditeur : à droite de l'image en paysage et sur écran large, en feuille à trois hauteurs en portrait. */}
        <aside
          aria-label={w.video.editor}
          style={sheetLayout && dragHeight !== null ? { height: dragHeight } : undefined}
          className={cn(
            "flex min-w-0 flex-col",
            !full && "gap-4 max-desktop:[&_:is(input,textarea,select)]:scroll-mt-[50dvh]",
            full && "overflow-hidden bg-card",
            sheetLayout && "rounded-t-hero border border-b-0 border-card-line pb-[env(safe-area-inset-bottom)]",
            sheetLayout &&
              (dragHeight !== null
                ? "transition-none"
                : sheet === "rail"
                  ? "transition-[height] duration-(--duration-quick) ease-elan"
                  : "transition-[height] duration-(--duration-enter) ease-reception"),
            sheetLayout && sheet === "rail" && "h-[calc(72px+env(safe-area-inset-bottom))]",
            sheetLayout && sheet === "half" && "h-[calc(var(--ih)/2)]",
            sheetLayout && sheet === "full" && "h-(--ih)",
            sideLayout &&
              "col-start-2 row-span-2 row-start-1 min-h-0 border-l border-card-line transition-[width] duration-(--duration-enter) ease-reception",
            sideLayout && (collapsed ? "w-14" : wide ? "w-[min(560px,50vw)]" : "w-[min(360px,45vw)]"),
          )}
        >
          {sheetLayout ? (
            <SheetHeader
              height={sheet}
              canAnnotate={canAnnotate}
              onHeight={(next) =>
                setSheet((current) =>
                  next === "grow" ? growSheet(current) : next === "shrink" ? shrinkSheet(current) : next,
                )
              }
              onDrag={setDragHeight}
              onAddRemark={addRemark}
            />
          ) : null}
          {sideLayout ? (
            <PanelHeader
              collapsed={collapsed}
              wide={wide}
              canAnnotate={canAnnotate}
              onCollapsed={setCollapsed}
              onWide={setWide}
              onAddRemark={addRemark}
            />
          ) : null}
          <div
            className={cn(
              full
                ? "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-4 pt-2"
                : "contents",
              editorHidden && "hidden",
            )}
          >
            <section aria-label={m.videoCollaboration.remarks} className="flex flex-col gap-2">
              {canAnnotate ? (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const drawing =
                      !replyTo && tool && drawingReady
                        ? { kind: tool, points: draft, aspect: frame.width / frame.height }
                        : null;
                    if ((text.trim() || drawing) && !add.isPending)
                      add.execute({
                        videoId: video.id,
                        tMs: replyTo?.tMs ?? Math.round(timeMs),
                        parentId: replyTo?.id,
                        phase: phase || null,
                        text,
                        drawing,
                      });
                  }}
                >
                  {replyTo ? (
                    <div className="border-l-2 border-control-line pl-3">
                      <p>{replyTo.text}</p>
                      <Button size="sm" variant="quiet" onClick={() => setReplyTo(null)}>
                        {m.common.cancel}
                      </Button>
                    </div>
                  ) : null}
                  <label htmlFor="annotation" className="sr-only">
                    {m.video.remarkAt(formatTimecode(timeMs))}
                  </label>
                  <input
                    id="annotation"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onFocus={() => {
                      if (sheetLayout) setSheet(sheetForRemark);
                    }}
                    placeholder={m.video.remarkAt(formatTimecode(timeMs))}
                    className="min-h-11 w-full rounded-full border border-control-line bg-transparent px-4 text-[16px] text-fg placeholder:text-fg-muted"
                  />
                  {replyTo || !frame.width ? null : (
                    <DrawingTools
                      tool={tool}
                      draft={draft}
                      helpId={drawingHelpId}
                      onTool={(next, keyboard) => {
                        // Le calque n'existe qu'avec un outil : il faut le rendre avant de lui donner le focus.
                        flushSync(() => {
                          setTool(next);
                          setDraft([]);
                        });
                        // On trace sur une image arrêtée.
                        if (next) ref.current?.pause();
                        if (next && keyboard) layerRef.current?.focus();
                      }}
                      onClear={clearDrawing}
                    />
                  )}
                  <CheckRow
                    label={m.video.highJumpTools}
                    checked={showJumpTools}
                    onChange={(e) => {
                      setJumpTools(e.target.checked);
                      setPhase("");
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <label htmlFor="phase" className="sr-only">
                      {showJumpTools ? m.video.jumpPhase : m.video.movementPhase}
                    </label>
                    <div className="min-w-36 flex-1">
                      <Select id="phase" value={phase} onChange={(e) => setPhase(e.target.value as JumpPhase | "")}>
                        <option value="">{m.video.noPhase}</option>
                        {phasesFor(showJumpTools).map((p) => (
                          <option key={p} value={p}>
                            {m.jumpPhase[p]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <button
                      type="submit"
                      disabled={add.isPending || (!text.trim() && !drawingReady)}
                      className="min-h-11 flex-1 whitespace-nowrap rounded-full bg-accent px-4 font-semibold text-on-accent disabled:opacity-50"
                    >
                      {m.video.addComment}
                    </button>
                  </div>
                </form>
              ) : null}
              {video.annotations.map((a) => (
                <div key={a.id} className="flex items-start gap-2.5 rounded-card bg-card-raised p-2.5">
                  <button
                    type="button"
                    onClick={() => seek(a.tMs)}
                    className="t-caption inline-flex min-h-11 shrink-0 items-center rounded-full px-1 font-semibold text-link underline"
                  >
                    {formatTimecode(a.tMs)}
                  </button>
                  <div className="min-w-0 flex-1 py-1.5">
                    {a.phase ? <p className="t-caption font-semibold text-soft">{m.jumpPhase[a.phase]}</p> : null}
                    <p className="t-caption flex items-center gap-1.5 text-soft">
                      <Avatar
                        person={{
                          name: a.authorName ?? "",
                          avatarUrl: a.authorAvatarUrl,
                          avatarPreset: a.authorAvatarPreset,
                        }}
                        size="xs"
                      />
                      {a.authorName ?? m.videoCollaboration.unknownAuthor}
                    </p>
                    {a.parentId ? <p className="text-sm text-soft">{m.videoCollaboration.replyTo}</p> : null}
                    {a.text ? <p className="break-words">{a.text}</p> : null}
                    {a.drawing ? (
                      <p className="t-caption font-semibold text-soft">
                        {describeDrawing(a.drawing, frame.width && frame.height ? frame.width / frame.height : 16 / 9)}
                      </p>
                    ) : null}
                    {canAnnotate && !a.parentId ? (
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => {
                          // Une réponse ne porte pas de tracé.
                          clearDrawing();
                          setReplyTo(a);
                          seek(a.tMs);
                          focusComposer();
                        }}
                      >
                        {m.videoCollaboration.reply}
                      </Button>
                    ) : null}
                  </div>
                  {staff || a.authorId === currentUserId ? (
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
            </section>

            {hasHighJumpContext(video) && video.barSheet.length > 0 ? (
              <section>
                <h2 className="t-section mb-2">{m.video.barSheet}</h2>
                <BarSheet rows={video.barSheet} current={video.barHeightCm} />
              </section>
            ) : null}

            <CommentThread
              entityType="video"
              entityId={video.id}
              comments={video.comments}
              currentUserId={currentUserId}
              path={path}
              dark
            />
          </div>
        </aside>
      </div>
    </div>
  );
};
