import { athletePaint, stagePaint } from "@tartan/design-tokens/athletes";
import { tokens } from "@tartan/design-tokens";
import {
  FLIGHT_TICKS,
  OUTCOME,
  RESET_TICKS,
  STAGE,
  TAKEOFF_TICK,
  type PoleVaultState,
} from "@tartan/game/events/pole-vault";
import { athleteRig } from "@tartan/mascot/athletes";
import { drawMascot } from "@tartan/mascot/canvas";
import { POLE_VAULT, POLE_VAULT_CLIP, POLE_VAULT_TIMES } from "@tartan/mascot/pole-vault";
import { drawProp } from "@tartan/mascot/props";
import type { SceneSize } from "./hurdles-scene";

// Une image du saut à la perche : le geste de packages/mascot, cadré dans le canvas, son temps réglé par l'étape de
// l'essai. La perche plie et se redresse avec le geste ; une barre tombée repose sur le tapis jusqu'à l'essai suivant.

const PAINT = athletePaint("poleVault", "piste");
const PROPS = stagePaint("piste");
const BONES = {
  neutral: athleteRig("poleVault", "neutral"),
  effort: athleteRig("poleVault", "effort"),
  joy: athleteRig("poleVault", "joy"),
};
const T = POLE_VAULT_TIMES;
// Où se pose le dernier appui avant le planté : un repère citron au sol.
const PLANT_X = POLE_VAULT_CLIP.frame(T.plant).root.x;

export const clipTime = (state: PoleVaultState): number => {
  if (state.stage === STAGE.approach) return T.run + (T.plant - T.run) * Math.min(1, state.t / TAKEOFF_TICK);
  if (state.stage === STAGE.flight) return T.plant + (T.impact - T.plant) * Math.min(1, state.t / FLIGHT_TICKS);
  if (state.outcome === OUTCOME.balked) return T.runEnd;
  const u = Math.min(1, state.t / RESET_TICKS);
  return state.outcome === OUTCOME.cleared ? T.impact + (1 - T.impact) * u : T.impact + (T.up - T.impact) * u;
};

export const drawPoleVault = (ctx: CanvasRenderingContext2D, size: SceneSize, state: PoleVaultState) => {
  const { width, height } = size;
  const stage = POLE_VAULT_CLIP.stage;
  const scale = Math.min(width / stage.width, height / stage.height);
  const left = (width - stage.width * scale) / 2;
  const top = (height - stage.height * scale) / 2;
  const t = clipTime(state);
  const { pose, root } = POLE_VAULT_CLIP.frame(t);
  const fallen = state.stage === STAGE.reset && state.outcome === OUTCOME.failed;
  const shapes = POLE_VAULT_CLIP.props(t).map((shape) =>
    fallen && shape.paint === "bar" && shape.kind === "line"
      ? {
          ...shape,
          from: { x: POLE_VAULT.bar.far.x, y: POLE_VAULT.mat.top - 4 },
          to: { x: POLE_VAULT.bar.near.x + 40, y: POLE_VAULT.mat.top + 30 },
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
  ctx.fillRect(PLANT_X - 40, stage.ground + 16, 80, 12);
  const face = POLE_VAULT_CLIP.face(t);
  drawMascot(ctx, pose, { paint: PAINT, bones: BONES[fallen ? "neutral" : face], at: root });
  for (const shape of shapes) if (shape.front) drawProp(ctx, shape, PROPS[shape.paint]);
  ctx.restore();
};
