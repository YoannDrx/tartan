"use client";

import type { VideoDrawing } from "@tartan/contracts";
import { clampPoint, drawingAngle, drawingPoints, type DrawingKind, type DrawingPoint } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Circle, MoveUpRight, Slash, Spline, X } from "lucide-react";
import { useId, useState, type KeyboardEvent, type MouseEvent, type Ref } from "react";
import { cn } from "@/lib/cn";
import { moveCursor, percent, samePoint } from "./immersive-layout";

const t = m.video.drawing;
const k = w.video.drawingKeyboard;
export const DRAWING_KINDS: DrawingKind[] = ["line", "arrow", "angle", "circle"];
const ICONS = { line: Slash, arrow: MoveUpRight, angle: Spline, circle: Circle } as const;

// Le nom d'un tracé pour les lecteurs d'écran : son type et, pour un angle, sa mesure.
export const describeDrawing = (drawing: VideoDrawing, aspect: number) => {
  const degrees = drawing.kind === "angle" ? drawingAngle(drawing.points, drawing.aspect ?? aspect) : null;
  return degrees === null ? t.kinds[drawing.kind] : t.angleOf(degrees);
};

const Shape = ({ drawing, width, height, marker }: { drawing: { kind: DrawingKind; points: DrawingPoint[] }; width: number; height: number; marker: string }) => {
  const p = drawing.points.map(({ x, y }) => ({ x: x * width, y: y * height }));
  const stroke = { stroke: "currentColor", strokeWidth: 4, strokeLinecap: "round" as const, fill: "none", vectorEffect: "non-scaling-stroke" as const };
  const dot = (point: { x: number; y: number }, key: number) => (
    <circle key={key} cx={point.x} cy={point.y} r={Math.max(width, height) / 160} fill="currentColor" />
  );
  if (p.length < 2) return <>{p.map(dot)}</>;
  if (drawing.kind === "circle")
    return <circle cx={p[0]!.x} cy={p[0]!.y} r={Math.hypot(p[1]!.x - p[0]!.x, p[1]!.y - p[0]!.y)} {...stroke} />;
  if (drawing.kind === "angle") {
    const degrees = p.length === 3 ? drawingAngle(drawing.points, width / height) : null;
    return (
      <g>
        <polyline points={p.map((q) => `${q.x},${q.y}`).join(" ")} {...stroke} />
        {p.map(dot)}
        {degrees !== null ? (
          <text
            x={p[1]!.x}
            y={p[1]!.y - Math.max(width, height) / 40}
            textAnchor="middle"
            fontSize={Math.max(width, height) / 22}
            fontWeight={700}
            fill="currentColor"
            paintOrder="stroke"
            stroke="var(--color-ink)"
            strokeWidth={Math.max(width, height) / 160}
          >
            {`${degrees}°`}
          </text>
        ) : null}
      </g>
    );
  }
  return <line x1={p[0]!.x} y1={p[0]!.y} x2={p[1]!.x} y2={p[1]!.y} {...stroke} markerEnd={drawing.kind === "arrow" ? `url(#${marker})` : undefined} />;
};

// Le repère du tracé au clavier : une mire, cernée d'encre pour rester lisible sur toute image.
const Crosshair = ({ point, width, height }: { point: DrawingPoint; width: number; height: number }) => {
  const x = point.x * width;
  const y = point.y * height;
  const r = Math.max(width, height) / 50;
  const arms = `M ${x - r * 1.8} ${y} H ${x - r * 0.5} M ${x + r * 0.5} ${y} H ${x + r * 1.8} M ${x} ${y - r * 1.8} V ${y - r * 0.5} M ${x} ${y + r * 0.5} V ${y + r * 1.8}`;
  const line = { fill: "none", strokeLinecap: "round" as const, vectorEffect: "non-scaling-stroke" as const };
  return (
    <g data-testid="drawing-cursor">
      <circle cx={x} cy={y} r={r} stroke="var(--color-ink)" strokeWidth={6} {...line} />
      <path d={arms} stroke="var(--color-ink)" strokeWidth={6} {...line} />
      <circle cx={x} cy={y} r={r} stroke="currentColor" strokeWidth={2} {...line} />
      <path d={arms} stroke="currentColor" strokeWidth={2} {...line} />
    </g>
  );
};

// Le calque posé sur l'image : même cadrage que la vidéo (contenu ajusté sans déformation), donc les points relatifs
// tombent exactement sur l'image, quelle que soit sa forme. En mode tracé, il reçoit les touchers, et le clavier :
// les flèches déplacent un repère, Entrée pose le point, Retour arrière reprend le dernier, Échap annule.
export const DrawingLayer = ({
  width,
  height,
  drawings,
  draft,
  tool,
  onDraft,
  onValidate,
  onCancel,
  describedBy,
  ref,
}: {
  width: number;
  height: number;
  drawings: VideoDrawing[];
  draft: DrawingPoint[];
  tool: DrawingKind | null;
  onDraft: (points: DrawingPoint[]) => void;
  onValidate: () => void;
  onCancel: () => void;
  describedBy?: string;
  ref?: Ref<SVGSVGElement>;
}) => {
  const marker = useId().replace(/:/g, "");
  const [cursor, setCursor] = useState<DrawingPoint>({ x: 0.5, y: 0.5 });
  const [keyboard, setKeyboard] = useState(false);
  const [message, setMessage] = useState("");
  const total = tool ? drawingPoints(tool) : 0;
  const complete = Boolean(tool) && draft.length >= total;

  const place = (event: MouseEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!tool || !matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const placed = clampPoint({ x: point.x / width, y: point.y / height });
    setKeyboard(false);
    setCursor(placed);
    onDraft(complete ? [placed] : [...draft, placed]);
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!tool || event.ctrlKey || event.metaKey || event.altKey) return;
    const moved = moveCursor(cursor, event.key, event.shiftKey);
    if (!moved && !["Enter", " ", "Backspace", "Delete", "Escape"].includes(event.key)) return;
    // Ces touches sont au tracé : ni la page ni les raccourcis de lecture ne doivent les prendre.
    event.preventDefault();
    event.stopPropagation();
    setKeyboard(true);
    if (moved) {
      setCursor(moved);
      setMessage(k.cursor(percent(moved.x), percent(moved.y)));
      // Tous les points posés : les flèches ajustent le dernier.
      if (complete) onDraft([...draft.slice(0, -1), moved]);
    } else if (event.key === "Escape") {
      setMessage(k.cancelled);
      onCancel();
    } else if (event.key === "Backspace" || event.key === "Delete") {
      const last = draft.at(-1);
      if (!last) return;
      setCursor(last);
      setMessage(k.undone(draft.length));
      onDraft(draft.slice(0, -1));
    } else if (complete) {
      onValidate();
    } else if (samePoint(draft.at(-1), cursor)) {
      setMessage(k.moveFirst);
    } else {
      const points = [...draft, cursor];
      setMessage(
        points.length === total ? k.ready : k.placed(points.length, total, percent(cursor.x), percent(cursor.y)),
      );
      onDraft(points);
    }
  };

  // Au clavier, le tracé en cours suit le repère avant même que le point soit posé.
  const pending = tool
    ? { kind: tool, points: keyboard && !complete ? [...draft, cursor] : draft }
    : null;
  const visible = [...drawings, ...(pending ? [pending] : [])];
  if (!width || !height || (!visible.length && !tool)) return null;
  const names = drawings.map((d) => describeDrawing(d, width / height)).join(", ");
  return (
    <>
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
          "absolute inset-0 size-full text-accent -outline-offset-4",
          tool ? "cursor-crosshair" : "pointer-events-none",
        )}
        role={tool ? "application" : drawings.length ? "img" : undefined}
        aria-label={tool ? k.area(t.kinds[tool]) : drawings.length ? names : undefined}
        aria-describedby={tool ? describedBy : undefined}
        aria-hidden={tool || drawings.length ? undefined : true}
        tabIndex={tool ? 0 : undefined}
        onClick={place}
        onKeyDown={onKeyDown}
        onFocus={(event) => setKeyboard(event.currentTarget.matches(":focus-visible"))}
        onBlur={() => setKeyboard(false)}
      >
        <defs>
          <marker id={marker} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {visible.map((drawing, index) => (
          <Shape key={index} drawing={drawing} width={width} height={height} marker={marker} />
        ))}
        {tool && keyboard ? <Crosshair point={cursor} width={width} height={height} /> : null}
      </svg>
      {tool ? (
        <p aria-live="polite" className="sr-only" data-testid="drawing-status">
          {message}
        </p>
      ) : null}
    </>
  );
};

// Les outils : un type de tracé, puis des touchers sur l'image arrêtée. Le tracé part avec la remarque.
export const DrawingTools = ({
  tool,
  draft,
  onTool,
  onClear,
  helpId,
}: {
  tool: DrawingKind | null;
  draft: DrawingPoint[];
  // `keyboard` : l'outil a été choisi au clavier, le tracé se fera donc au clavier.
  onTool: (tool: DrawingKind | null, keyboard: boolean) => void;
  onClear: () => void;
  helpId: string;
}) => (
  <div className="flex flex-col gap-2">
    <div role="group" aria-label={t.title} className="flex flex-wrap items-center gap-2">
      {DRAWING_KINDS.map((kind) => {
        const Icon = ICONS[kind];
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={tool === kind}
            data-drawing-tool={kind}
            // Un clic sans pointeur (Entrée, Espace) ne porte aucun détail.
            onClick={(event) => onTool(tool === kind ? null : kind, event.detail === 0)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-full border border-control-line px-3 text-sm font-semibold",
              tool === kind && "border-transparent bg-accent text-on-accent",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {t.kinds[kind]}
          </button>
        );
      })}
      {tool || draft.length ? (
        <button type="button" onClick={onClear} className="flex min-h-11 items-center gap-2 rounded-full px-3 text-sm">
          <X aria-hidden className="size-4" />
          {t.clear}
        </button>
      ) : null}
    </div>
    {tool ? (
      <p aria-live="polite" className="t-caption text-soft">
        {draft.length >= drawingPoints(tool) ? t.ready : t.place(drawingPoints(tool) - draft.length)}
      </p>
    ) : null}
    {/* L'aide du clavier se lit là où il y a un clavier ; le calque la porte en description dans tous les cas. */}
    <p id={helpId} className={cn("t-caption text-soft", tool ? "hidden [@media(hover:hover)]:block" : "hidden")}>
      {k.help}
    </p>
  </div>
);
