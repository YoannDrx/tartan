// Les accessoires des épreuves : des formes simples dans le repère de la scène, que chaque rendu dessine à sa façon.
import type { Point } from "./skeleton";
import type { SvgShape } from "./svg";

// Ce qu'un rendu doit colorer. Les couleurs viennent de l'hôte, donc des jetons de design.
export type PropRole =
  "lane" | "bar" | "post" | "mat" | "matTop" | "sand" | "board" | "foul" | "pole" | "hurdle" | "discus";
export type PropPaint = Record<PropRole, string>;

// `front` : dessiné devant l'athlète. Sinon derrière lui.
type Placed = { paint: PropRole; front?: boolean };

export type PropShape = Placed &
  (
    | { kind: "line"; from: Point; to: Point; width: number; cap?: "round" | "butt" }
    | { kind: "rect"; x: number; y: number; width: number; height: number; radius?: number }
    | { kind: "disc"; x: number; y: number; radius: number }
    // Une courbe à un point de contrôle : la perche qui fléchit.
    | { kind: "curve"; from: Point; control: Point; to: Point; width: number }
  );

const round = (value: number) => Math.round(value * 100) / 100;

export const svgProp = (shape: PropShape, color: string): SvgShape => {
  switch (shape.kind) {
    case "line":
      return {
        tag: "line",
        x1: round(shape.from.x),
        y1: round(shape.from.y),
        x2: round(shape.to.x),
        y2: round(shape.to.y),
        stroke: color,
        strokeWidth: shape.width,
        strokeLinecap: shape.cap ?? "round",
      };
    case "rect":
      return {
        tag: "rect",
        x: round(shape.x),
        y: round(shape.y),
        width: shape.width,
        height: shape.height,
        rx: shape.radius ?? 0,
        fill: color,
      };
    case "disc":
      return { tag: "circle", cx: round(shape.x), cy: round(shape.y), r: shape.radius, fill: color };
    case "curve":
      return {
        tag: "path",
        d: `M ${round(shape.from.x)} ${round(shape.from.y)} Q ${round(shape.control.x)} ${round(shape.control.y)} ${round(shape.to.x)} ${round(shape.to.y)}`,
        fill: "none",
        stroke: color,
        strokeWidth: shape.width,
        strokeLinecap: "round",
      };
  }
};

// Ce dont le dessin d'un accessoire a besoin. Un CanvasRenderingContext2D convient.
export type PropCanvas = {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineCap: string;
};

const QUARTER = Math.PI / 2;

export const drawProp = (ctx: PropCanvas, shape: PropShape, color: string) => {
  ctx.beginPath();
  if (shape.kind === "line" || shape.kind === "curve") {
    ctx.moveTo(shape.from.x, shape.from.y);
    if (shape.kind === "line") ctx.lineTo(shape.to.x, shape.to.y);
    else ctx.quadraticCurveTo(shape.control.x, shape.control.y, shape.to.x, shape.to.y);
    ctx.lineWidth = shape.width;
    ctx.lineCap = shape.kind === "line" && shape.cap === "butt" ? "butt" : "round";
    ctx.strokeStyle = color;
    ctx.stroke();
    return;
  }
  if (shape.kind === "disc") {
    ctx.arc(shape.x, shape.y, shape.radius, 0, 4 * QUARTER);
  } else {
    const { x, y, width, height } = shape;
    const r = Math.min(shape.radius ?? 0, width / 2, height / 2);
    ctx.arc(x + width - r, y + r, r, -QUARTER, 0);
    ctx.arc(x + width - r, y + height - r, r, 0, QUARTER);
    ctx.arc(x + r, y + height - r, r, QUARTER, 2 * QUARTER);
    ctx.arc(x + r, y + r, r, 2 * QUARTER, 3 * QUARTER);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
};
