// Le rendu canvas 2D : une fonction pure, qui dessine la pose demandée dans le contexte qu'on lui donne.
import { chain, STACK, type Paint, type Point, type Pose, type Shape } from "./skeleton";

// Ce dont le dessin a besoin. Un CanvasRenderingContext2D convient, un contexte hors écran aussi.
export type MascotCanvas = {
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineCap: string;
};

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const QUARTER = Math.PI / 2;

const draw = (ctx: MascotCanvas, shape: Shape, color: string) => {
  ctx.beginPath();
  switch (shape.kind) {
    case "limb":
      ctx.moveTo(0, 0);
      ctx.lineTo(0, shape.length);
      ctx.lineWidth = shape.width;
      ctx.lineCap = "round";
      ctx.strokeStyle = color;
      ctx.stroke();
      return;
    case "box": {
      const { x, y, width, height } = shape;
      const r = Math.min(shape.radius, width / 2, height / 2);
      // Quatre coins ronds : le tracé relie de lui-même chaque arc au suivant.
      ctx.arc(x + width - r, y + r, r, -QUARTER, 0);
      ctx.arc(x + width - r, y + height - r, r, 0, QUARTER);
      ctx.arc(x + r, y + height - r, r, QUARTER, 2 * QUARTER);
      ctx.arc(x + r, y + r, r, 2 * QUARTER, 3 * QUARTER);
      break;
    }
    case "disc":
      ctx.arc(shape.x, shape.y, shape.radius, 0, 4 * QUARTER);
      break;
    case "cap": {
      // Le centre du cercle passe sous la corde : l'arc monte par-dessus, d'un bout à l'autre.
      const { radius, chord } = shape;
      const drop = Math.sqrt(radius * radius - chord.x * chord.x);
      ctx.arc(0, chord.y + drop, radius, Math.atan2(-drop, -chord.x), Math.atan2(-drop, chord.x));
      break;
    }
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
};

// Dessine la mascotte. `at` place le bassin, `scale` change la taille du personnage sans toucher à la pose.
export const drawMascot = (
  ctx: MascotCanvas,
  pose: Pose,
  { paint, at, scale = 1 }: { paint: Paint; at?: Point; scale?: number },
) => {
  ctx.save();
  if (at) ctx.translate(at.x, at.y);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.rotate(radians(pose.rot));
  ctx.scale(pose.flip * pose.sx, pose.sy);
  for (const bone of STACK) {
    ctx.save();
    for (const step of chain(bone, pose)) {
      if ("move" in step) ctx.translate(step.move.x, step.move.y);
      else ctx.rotate(radians(step.turn));
    }
    for (const shape of bone.shapes) draw(ctx, shape, paint[shape.paint]);
    ctx.restore();
  }
  ctx.restore();
};
