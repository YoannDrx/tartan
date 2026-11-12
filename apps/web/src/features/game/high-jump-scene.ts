import { athletePaint, stagePaint } from "@tartan/design-tokens/athletes";
import { tokens } from "@tartan/design-tokens";
import {
  FLIGHT_TICKS,
  OUTCOME,
  RESET_TICKS,
  STAGE,
  TAKEOFF_TICK,
  type HighJumpState,
} from "@tartan/game/events/high-jump";
import { athleteRig } from "@tartan/mascot/athletes";
import { drawMascot } from "@tartan/mascot/canvas";
import { HIGH_JUMP_PHASES, HIGH_JUMP_STAGE } from "@tartan/mascot/high-jump";
import { HIGH_JUMP_BAR, HIGH_JUMP_CLIP } from "@tartan/mascot/high-jump-event";
import { drawProp } from "@tartan/mascot/props";
import type { SceneSize } from "./hurdles-scene";

// Une image du saut en hauteur : le geste de packages/mascot, cadré dans le canvas, son temps réglé par l'étape de
// l'essai. Une barre tombée repose sur le tapis jusqu'à l'essai suivant.

const PAINT = athletePaint("highJump", "piste");
const PROPS = stagePaint("piste");
const BONES = {
  neutral: athleteRig("highJump", "neutral"),
  effort: athleteRig("highJump", "effort"),
  joy: athleteRig("highJump", "joy"),
};
const P = HIGH_JUMP_PHASES;
// Où se pose le dernier appui : un repère citron au sol, l'appel se règle dessus.
const PLANT_X = HIGH_JUMP_CLIP.frame(P.takeoff[0]).root.x;

// L'instant du geste, de 0 à 1, pour l'état de l'essai.
export const clipTime = (state: HighJumpState): number => {
  if (state.stage === STAGE.approach)
    return P.ready[1] + (P.takeoff[0] - P.ready[1]) * Math.min(1, state.t / TAKEOFF_TICK);
  if (state.stage === STAGE.flight)
    return P.takeoff[0] + (P.flight[1] - P.takeoff[0]) * Math.min(1, state.t / FLIGHT_TICKS);
  if (state.outcome === OUTCOME.balked) return P.gather[0];
  const u = Math.min(1, state.t / RESET_TICKS);
  return state.outcome === OUTCOME.cleared
    ? P.landing[0] + (1 - P.landing[0]) * u
    : P.landing[0] + (P.landing[1] - P.landing[0]) * u;
};

export const drawHighJump = (ctx: CanvasRenderingContext2D, size: SceneSize, state: HighJumpState) => {
  const { width, height } = size;
  const stage = HIGH_JUMP_CLIP.stage;
  const scale = Math.min(width / stage.width, height / stage.height);
  const left = (width - stage.width * scale) / 2;
  const top = (height - stage.height * scale) / 2;
  const t = clipTime(state);
  const { pose, root } = HIGH_JUMP_CLIP.frame(t);
  const fallen = state.stage === STAGE.reset && state.outcome === OUTCOME.failed;
  const shapes = HIGH_JUMP_CLIP.props(t).map((shape) =>
    // La barre tombée : posée sur le tapis, en travers.
    fallen && shape.paint === "bar" && shape.kind === "line"
      ? {
          ...shape,
          from: { x: HIGH_JUMP_BAR.far.x, y: HIGH_JUMP_STAGE.matTop - 4 },
          to: { x: HIGH_JUMP_BAR.near.x - 60, y: HIGH_JUMP_STAGE.matTop + 30 },
        }
      : shape,
  );

  ctx.fillStyle = tokens.band.background;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(left, top);
  ctx.scale(scale, scale);
  for (const shape of shapes) if (!shape.front) drawProp(ctx, shape, PROPS[shape.paint]);
  ctx.fillStyle = tokens.band.action;
  ctx.fillRect(PLANT_X - 40, HIGH_JUMP_STAGE.ground + 16, 80, 12);
  const face = HIGH_JUMP_CLIP.face(t);
  drawMascot(ctx, pose, { paint: PAINT, bones: BONES[fallen ? "neutral" : face], at: root });
  for (const shape of shapes) if (shape.front) drawProp(ctx, shape, PROPS[shape.paint]);
  ctx.restore();
};
