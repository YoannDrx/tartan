"use client";

import type { VideoDrawing } from "@tartan/contracts";
import { clampPoint, drawingAngle, drawingPoints, type DrawingKind, type DrawingPoint } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Circle, MoveUpRight, Slash, Spline, X } from "lucide-react";
import { useId, type MouseEvent } from "react";
import { cn } from "@/lib/cn";

const t = m.video.drawing;
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

// Le calque posé sur l'image : même cadrage que la vidéo (contenu ajusté sans déformation), donc les points relatifs
// tombent exactement sur l'image, quelle que soit sa forme. En mode tracé, il reçoit les touchers.
export const DrawingLayer = ({
  width,
  height,
  drawings,
  draft,
  tool,
  onPoint,
}: {
  width: number;
  height: number;
  drawings: VideoDrawing[];
  draft: { kind: DrawingKind; points: DrawingPoint[] } | null;
  tool: DrawingKind | null;
  onPoint: (point: DrawingPoint) => void;
}) => {
  const marker = useId().replace(/:/g, "");
  const place = (event: MouseEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!tool || !matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    onPoint(clampPoint({ x: point.x / width, y: point.y / height }));
  };
  const visible = [...drawings, ...(draft ? [draft] : [])];
  if (!width || !height || (!visible.length && !tool)) return null;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn("absolute inset-0 size-full text-accent", tool ? "cursor-crosshair" : "pointer-events-none")}
      role={drawings.length ? "img" : undefined}
      aria-label={drawings.length ? drawings.map((d) => describeDrawing(d, width / height)).join(", ") : undefined}
      aria-hidden={drawings.length ? undefined : true}
      onClick={place}
    >
      <defs>
        <marker id={marker} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>
      {visible.map((drawing, index) => (
        <Shape key={index} drawing={drawing} width={width} height={height} marker={marker} />
      ))}
    </svg>
  );
};

// Les outils : un type de tracé, puis des touchers sur l'image arrêtée. Le tracé part avec la remarque.
export const DrawingTools = ({
  tool,
  draft,
  onTool,
  onClear,
}: {
  tool: DrawingKind | null;
  draft: DrawingPoint[];
  onTool: (tool: DrawingKind | null) => void;
  onClear: () => void;
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
            onClick={() => onTool(tool === kind ? null : kind)}
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
  </div>
);
