"use client";

import { tokens } from "@tartan/design-tokens";
import { w } from "@tartan/i18n/web";
import { RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import {
  START,
  centerOn,
  clampCrop,
  drawTransform,
  moveBy,
  rotate,
  zoomTo,
  type CropFit,
  type CropState,
} from "./crop-geometry";

const t = w.profile.crop;
// Le fichier exporté : un carré de 512 pixels, assez net pour un écran dense, léger à envoyer.
export const EXPORT_SIZE = 512;
// Au clavier, une flèche déplace de 8 pixels, avec Maj de 32 ; plus et moins changent le zoom de 10 %.
const STEP = 8;
const BIG_STEP = 32;
const ZOOM_STEP = 0.1;
// En deçà, un appui est un toucher (qui centre le point) et non un glisser.
const TAP_SLOP = 4;

const draw = (canvas: HTMLCanvasElement, bitmap: ImageBitmap, state: CropState, frame: number, fit: CropFit) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  const tr = drawTransform(bitmap, state, frame, size, fit);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingQuality = "high";
  ctx.translate(tr.translateX, tr.translateY);
  ctx.rotate(tr.rotation);
  ctx.scale(tr.scale, tr.scale);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
};

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));

// L'export : WebP quand le navigateur sait l'écrire, sinon JPEG. Un JPEG n'a pas de transparence : fond blanc.
export const exportCrop = async (bitmap: ImageBitmap, state: CropState, frame: number, fit: CropFit) => {
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;
  draw(canvas, bitmap, state, frame, fit);
  const webp = await toBlob(canvas, "image/webp");
  if (webp?.type === "image/webp") return new File([webp], "photo.webp", { type: "image/webp" });
  const flat = document.createElement("canvas");
  flat.width = EXPORT_SIZE;
  flat.height = EXPORT_SIZE;
  const ctx = flat.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = tokens.color.white;
  ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
  ctx.drawImage(canvas, 0, 0);
  const jpeg = await toBlob(flat, "image/jpeg");
  return jpeg ? new File([jpeg], "photo.jpg", { type: "image/jpeg" }) : null;
};

// Une image ouverte, tournée selon sa prise de vue (EXIF) : un portrait pris au téléphone n'arrive pas couché.
export const openImage = (file: File) => createImageBitmap(file, { imageOrientation: "from-image" });

type Pointer = { x: number; y: number };

export const ImageCropper = ({
  bitmap,
  fit,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  bitmap: ImageBitmap | null;
  // `cover` : une photo, dans un cercle ; `contain` : un logo, dans un carré, qui peut rester plus petit.
  fit: CropFit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (state: CropState, frame: number) => void;
  saving: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);
  const [state, setState] = useState<CropState>(START);
  const pointers = useRef(new Map<number, Pointer>());
  const gesture = useRef<{ moved: number; distance: number | null; mid: Pointer | null }>({
    moved: 0,
    distance: null,
    mid: null,
  });
  const logo = fit === "contain";

  // Le cadre suit la largeur du dialogue : mesuré dès que la scène existe, puis redessiné à la densité de l'écran.
  const stageRef = useCallback((stage: HTMLDivElement | null) => {
    if (!stage) return;
    const measure = () => setFrame(stage.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!bitmap || frame === 0) return;
    const canvas = canvasRef.current;
    const preview = previewRef.current;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    if (canvas) {
      canvas.width = Math.round(frame * ratio);
      canvas.height = canvas.width;
      draw(canvas, bitmap, state, frame, fit);
    }
    if (preview) {
      preview.width = Math.round(64 * ratio);
      preview.height = preview.width;
      draw(preview, bitmap, state, frame, fit);
    }
  }, [bitmap, state, frame, fit]);

  const update = useCallback(
    (next: (current: CropState) => CropState) => setState((current) => (bitmap ? next(current) : current)),
    [bitmap],
  );

  const local = (event: PointerEvent): Pointer => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const pair = () => {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return null;
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!bitmap) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, local(event));
    const two = pair();
    gesture.current = {
      moved: pointers.current.size > 1 ? TAP_SLOP + 1 : 0,
      distance: two?.distance ?? null,
      mid: two?.mid ?? null,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const before = pointers.current.get(event.pointerId);
    if (!before || !bitmap) return;
    const now = local(event);
    pointers.current.set(event.pointerId, now);
    const two = pair();
    if (two && gesture.current.distance && gesture.current.mid) {
      // Le pincement : l'écart des deux doigts règle le zoom, leur milieu déplace l'image.
      const { distance, mid } = gesture.current;
      update((s) => {
        const zoomed = zoomTo(bitmap, s, (s.zoom * two.distance) / distance, frame, fit);
        return moveBy(bitmap, zoomed, two.mid.x - mid.x, two.mid.y - mid.y, frame, fit);
      });
      gesture.current = { moved: TAP_SLOP + 1, distance: two.distance, mid: two.mid };
      return;
    }
    const dx = now.x - before.x;
    const dy = now.y - before.y;
    gesture.current.moved += Math.hypot(dx, dy);
    update((s) => moveBy(bitmap, s, dx, dy, frame, fit));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const point = pointers.current.get(event.pointerId);
    pointers.current.delete(event.pointerId);
    if (point && bitmap && pointers.current.size === 0 && gesture.current.moved <= TAP_SLOP) {
      update((s) => centerOn(bitmap, s, point, frame, fit));
    }
    const two = pair();
    gesture.current = { ...gesture.current, distance: two?.distance ?? null, mid: two?.mid ?? null };
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!bitmap) return;
    const step = event.shiftKey ? BIG_STEP : STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      update((s) => moveBy(bitmap, s, move[0], move[1], frame, fit));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      update((s) => zoomTo(bitmap, s, s.zoom + ZOOM_STEP, frame, fit));
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      update((s) => zoomTo(bitmap, s, s.zoom - ZOOM_STEP, frame, fit));
    }
  };

  const zoomPct = Math.round(state.zoom * 100);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
      title={logo ? t.titleLogo : t.title}
      description={logo ? t.detailLogo : t.detail}
    >
      <div className="flex flex-col gap-4">
        <div
          ref={stageRef}
          role="group"
          tabIndex={0}
          aria-label={t.stage}
          aria-describedby="crop-status"
          data-testid="crop-stage"
          data-crop={`${Math.round(state.x)},${Math.round(state.y)},${zoomPct},${state.turns}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className={cn(
            "relative mx-auto aspect-square w-full max-w-[320px] cursor-grab touch-none select-none overflow-hidden rounded-thumb bg-card-raised active:cursor-grabbing",
          )}
        >
          <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />
          {/* Le cadre : un cercle pour une photo, le carré entier pour un logo, tracé en double ligne de couloir. */}
          <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full">
            {logo ? (
              <>
                <rect
                  x="1"
                  y="1"
                  width="98"
                  height="98"
                  rx="3"
                  fill="none"
                  className="stroke-band-lane"
                  strokeWidth="0.8"
                />
                <rect
                  x="3.5"
                  y="3.5"
                  width="93"
                  height="93"
                  rx="2"
                  fill="none"
                  className="stroke-band-lane"
                  strokeWidth="0.8"
                />
              </>
            ) : (
              <>
                <path fillRule="evenodd" d="M0 0H100V100H0Z M50 2 A48 48 0 1 0 50.001 2 Z" className="fill-ink/60" />
                <circle cx="50" cy="50" r="48" fill="none" className="stroke-band-lane" strokeWidth="0.8" />
                <circle cx="50" cy="50" r="45.5" fill="none" className="stroke-band-lane" strokeWidth="0.8" />
              </>
            )}
          </svg>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex flex-col items-center gap-1">
            <canvas
              ref={previewRef}
              aria-hidden
              className={cn("size-16 bg-card-raised", logo ? "rounded-thumb" : "rounded-full")}
            />
            <span className="t-caption font-normal text-soft">{t.preview}</span>
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-1">
              <IconButton
                label={t.zoomOut}
                disabled={!bitmap || state.zoom <= 1}
                onClick={() => bitmap && update((s) => zoomTo(bitmap, s, s.zoom - ZOOM_STEP * 2, frame, fit))}
              >
                <ZoomOut aria-hidden className="size-5" />
              </IconButton>
              <label className="flex min-w-0 flex-1 items-center">
                <span className="sr-only">{t.zoom}</span>
                <input
                  type="range"
                  min={100}
                  max={400}
                  step={1}
                  value={zoomPct}
                  aria-valuetext={`${zoomPct} %`}
                  disabled={!bitmap}
                  onChange={(e) => bitmap && update((s) => zoomTo(bitmap, s, Number(e.target.value) / 100, frame, fit))}
                  className="h-11 w-full min-w-0 cursor-pointer accent-cta"
                />
              </label>
              <IconButton
                label={t.zoomIn}
                disabled={!bitmap || state.zoom >= 4}
                onClick={() => bitmap && update((s) => zoomTo(bitmap, s, s.zoom + ZOOM_STEP * 2, frame, fit))}
              >
                <ZoomIn aria-hidden className="size-5" />
              </IconButton>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <IconButton
                label={t.rotateLeft}
                disabled={!bitmap}
                onClick={() => bitmap && update((s) => rotate(bitmap, s, -1, frame, fit))}
              >
                <RotateCcw aria-hidden className="size-5" />
              </IconButton>
              <IconButton
                label={t.rotateRight}
                disabled={!bitmap}
                onClick={() => bitmap && update((s) => rotate(bitmap, s, 1, frame, fit))}
              >
                <RotateCw aria-hidden className="size-5" />
              </IconButton>
              <Button
                size="sm"
                variant="quiet"
                disabled={!bitmap}
                onClick={() => bitmap && setState(clampCrop(bitmap, START, frame, fit))}
              >
                {t.reset}
              </Button>
            </div>
          </div>
        </div>
        <p id="crop-status" aria-live="polite" className="sr-only">
          {t.status(zoomPct, state.turns)}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!bitmap || saving || frame === 0} onClick={() => onSave(state, frame)}>
            {saving ? t.saving : logo ? t.saveLogo : t.save}
          </Button>
          <Button size="sm" variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
