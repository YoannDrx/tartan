import { athletePaint, stagePaint } from "@tartan/design-tokens/athletes";
import { tokens } from "@tartan/design-tokens";
import { PHASE, SECTOR_HALF, TURN, type DiscusState } from "@tartan/game/events/discus";
import { athleteRig } from "@tartan/mascot/athletes";
import { drawMascot } from "@tartan/mascot/canvas";
import { DISCUS_CLIP, DISCUS_TIMES } from "@tartan/mascot/discus";
import { drawProp } from "@tartan/mascot/props";
import type { SceneSize } from "./hurdles-scene";

// Une image du disque : le geste de packages/mascot, cadré dans le canvas, et un cadran vu de dessus. Sur le cadran,
// le secteur de lancer en citron et le bras qui tourne : on lâche quand le bras passe dans le secteur.

const PAINT = athletePaint("discus", "piste");
const PROPS = stagePaint("piste");
const BONES = {
  neutral: athleteRig("discus", "neutral"),
  effort: athleteRig("discus", "effort"),
  joy: athleteRig("discus", "joy"),
};
const T = DISCUS_TIMES;
// Le lâcher dure ce nombre de pas à l'image, puis le disque vole.
const RELEASE_TICKS = 18;

export const clipTime = (state: DiscusState): number => {
  if (state.phase === PHASE.waiting) return T.stance;
  if (state.phase === PHASE.spinning) {
    if (state.foul || state.overturned) return T.recover;
    return T.turn + (T.power - T.turn) * ((state.rotation % TURN) / TURN);
  }
  if (state.air < RELEASE_TICKS) return T.power + (T.follow - T.power) * (state.air / RELEASE_TICKS);
  const u = Math.min(1, (state.air - RELEASE_TICKS) / Math.max(1, state.flightTicks - RELEASE_TICKS));
  return state.finished ? T.land + (T.cheer - T.land) : T.follow + (T.land - T.follow) * u;
};

const drawGauge = (ctx: CanvasRenderingContext2D, size: SceneSize, state: DiscusState) => {
  const radius = Math.max(26, Math.min(size.width, size.height) * 0.13);
  const cx = radius + 14;
  const cy = radius + 14;
  const toRad = (sixteenths: number) => (sixteenths / 16) * (Math.PI / 180);
  ctx.strokeStyle = tokens.band.lane;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  // Le secteur, vers la droite : c'est là que le disque doit partir.
  ctx.fillStyle = tokens.band.action;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius, -toRad(SECTOR_HALF), toRad(SECTOR_HALF));
  ctx.closePath();
  ctx.fill();
  // Le bras : il tourne avec le lanceur.
  const arm = -toRad(state.angle);
  ctx.strokeStyle = tokens.band.lane;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(arm) * radius * 0.9, cy - Math.sin(-arm) * radius * 0.9);
  ctx.stroke();
};

export const drawDiscus = (ctx: CanvasRenderingContext2D, size: SceneSize, state: DiscusState) => {
  const { width, height } = size;
  const stage = DISCUS_CLIP.stage;
  const scale = Math.min(width / stage.width, height / stage.height);
  const left = (width - stage.width * scale) / 2;
  const top = (height - stage.height * scale) / 2;
  const t = clipTime(state);
  const { pose, root } = DISCUS_CLIP.frame(t);
  // Le disque ne vole que si l'essai est valable.
  const shapes = DISCUS_CLIP.props(t).filter(
    (shape) => !(shape.paint === "discus" && (state.foul || state.overturned)),
  );

  ctx.fillStyle = tokens.band.background;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(left, top);
  ctx.scale(scale, scale);
  for (const shape of shapes) if (!shape.front) drawProp(ctx, shape, PROPS[shape.paint]);
  const face = state.foul || state.overturned ? "neutral" : DISCUS_CLIP.face(t);
  drawMascot(ctx, pose, { paint: PAINT, bones: BONES[face], at: root });
  for (const shape of shapes) if (shape.front) drawProp(ctx, shape, PROPS[shape.paint]);
  ctx.restore();
  drawGauge(ctx, size, state);
};
