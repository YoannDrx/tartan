// Le rendu canvas 2D : une fonction pure, qui dessine la pose demandée dans le contexte qu'on lui donne.
import { chain, STACK, type AthletePaint, type Bone, type Point, type Pose, type Shape } from "./skeleton";

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
    case "stroke": {
      const [from, to] =
        shape.kind === "limb"
          ? [
              { x: 0, y: 0 },
              { x: 0, y: shape.length },
            ]
          : [shape.from, shape.to];
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.lineWidth = shape.width;
      ctx.lineCap = "round";
      ctx.strokeStyle = color;
      ctx.stroke();
      return;
    }
    case "segment":
      // closePath trace la corde.
      ctx.arc(shape.x, shape.y, shape.radius, radians(shape.from), radians(shape.to));
      break;
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
// `bones` : les os d'un athlète du groupe (rig.ts), déjà triés. Sans eux, le corps de base.
export const drawMascot = (
  ctx: MascotCanvas,
  pose: Pose,
  {
    paint,
    at,
    scale = 1,
    bones = STACK,
  }: { paint: Partial<AthletePaint>; at?: Point; scale?: number; bones?: readonly Bone[] },
) => {
  const among = new Map(bones.map((bone) => [bone.id, bone]));
  ctx.save();
  if (at) ctx.translate(at.x, at.y);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.rotate(radians(pose.rot));
  ctx.scale(pose.flip * pose.sx, pose.sy);
  for (const bone of bones) {
    ctx.save();
    for (const step of chain(bone, pose, among)) {
      if ("move" in step) ctx.translate(step.move.x, step.move.y);
      else if ("turn" in step) ctx.rotate(radians(step.turn));
      else ctx.scale(-1, 1);
    }
    for (const shape of bone.shapes) draw(ctx, shape, paint[shape.paint]!);
    ctx.restore();
  }
  ctx.restore();
};
