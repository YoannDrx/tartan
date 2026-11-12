import { athletePaint, stagePaint } from "@tartan/design-tokens/athletes";
import { tokens } from "@tartan/design-tokens";
import {
  BOARD_X,
  PHASE,
  PIT_START_MM,
  UNITS_PER_MM,
  doneBefore,
  type TripleJumpState,
} from "@tartan/game/events/triple-jump";
import { athleteRig } from "@tartan/mascot/athletes";
import { drawMascot } from "@tartan/mascot/canvas";
import { HURDLE_PX_PER_M, hurdlerHipAbove as hipAboveFoot, hurdlerPose } from "@tartan/mascot/hurdles";
import { POSES } from "@tartan/mascot/poses";
import { TRIPLE_JUMP_CLIP, TRIPLE_JUMP_TIMES } from "@tartan/mascot/triple-jump";
import { pixelsPerMetre, type SceneSize } from "./hurdles-scene";

// Une image du triple saut : la piste d'élan, la planche, le sable loin devant, et Awa. Les trois bonds suivent les
// trois temps du geste de packages/mascot.

const PAINT = athletePaint("tripleJump", "piste");
const PROPS = stagePaint("piste");
const BONES = {
  neutral: athleteRig("tripleJump", "neutral"),
  effort: athleteRig("tripleJump", "effort"),
  joy: athleteRig("tripleJump", "joy"),
};
const BOARD_M = BOARD_X / UNITS_PER_MM / 1000;
const PIT = { from: BOARD_M + PIT_START_MM / 1000, to: BOARD_M + 18 };
const T = TRIPLE_JUMP_TIMES;
const WINDOWS = [
  [T.takeoff, T.hopOff],
  [T.hopOff, T.stepOff],
  [T.stepOff, T.touch],
] as const;
const boundPose = (phase: number, u: number) => {
  const [from, to] = WINDOWS[phase - 1] ?? WINDOWS[2];
  return TRIPLE_JUMP_CLIP.frame(from + (to - from) * u).pose;
};
const SQUAT = TRIPLE_JUMP_CLIP.frame(T.squat).pose;

const placeOf = (state: TripleJumpState) => {
  if (state.phase === PHASE.run) return { x: state.x / UNITS_PER_MM / 1000, lift: 0, u: null as number | null };
  const from = state.takeoffX / UNITS_PER_MM / 1000 + doneBefore(state) / 1000;
  const u = Math.min(1, state.air / Math.max(1, state.flightTicks));
  const length = (state.bounds[state.phase - 1] ?? 0) / 1000;
  return { x: from + length * u, lift: (4 * state.peak * u * (1 - u)) / 1000, u };
};

export const drawTripleJump = (
  ctx: CanvasRenderingContext2D,
  size: SceneSize,
  state: TripleJumpState,
  label: (metres: number) => string,
  family: string,
) => {
  const { width, height } = size;
  const ppm = pixelsPerMetre(size);
  const scale = ppm / HURDLE_PX_PER_M;
  const lane = Math.round(height * 0.78);
  const place = placeOf(state);
  const camera = place.x - (width * 0.32) / ppm;
  const toX = (m: number) => (m - camera) * ppm;

  ctx.fillStyle = tokens.band.background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = PROPS.sand;
  ctx.fillRect(toX(PIT.from), lane - 4, (PIT.to - PIT.from) * ppm, Math.round(ppm * 0.9) + 8);
  ctx.fillStyle = tokens.band.lane;
  ctx.fillRect(0, lane, Math.max(0, Math.min(width, toX(PIT.from))), 3);
  ctx.fillRect(Math.max(0, toX(PIT.to)), lane, width, 3);
  ctx.fillRect(0, lane + Math.round(ppm * 0.9), width, 3);

  ctx.fillStyle = PROPS.board;
  ctx.fillRect(toX(BOARD_M - 0.2), lane - 3, 0.2 * ppm, 7);
  ctx.fillStyle = PROPS.foul;
  ctx.fillRect(toX(BOARD_M), lane - 3, 0.1 * ppm, 7);

  ctx.font = `600 ${Math.round(Math.max(12, ppm * 0.3))}px ${family}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = tokens.band.lane;
  for (let mark = 10; mark <= 16; mark += 1) {
    const x = toX(BOARD_M + mark);
    if (x < -ppm || x > width + ppm) continue;
    ctx.fillRect(x - 1, lane + Math.round(ppm * 0.2), 2, Math.round(ppm * 0.5));
    ctx.fillText(label(mark), x + 6, lane + Math.round(ppm * 0.45));
  }

  // Pendant le cloche-pied et la foulée, un repère citron marque où le pied va toucher : l'appui se règle dessus.
  if (!state.finished && (state.phase === PHASE.hop || state.phase === PHASE.step)) {
    const touch = toX(
      state.takeoffX / UNITS_PER_MM / 1000 + (doneBefore(state) + (state.bounds[state.phase - 1] ?? 0)) / 1000,
    );
    ctx.fillStyle = tokens.band.action;
    ctx.fillRect(touch - ppm * 0.25, lane - 3, ppm * 0.5, 7);
    ctx.fillStyle = tokens.band.lane;
  }

  const landed = state.finished && !state.foul && !state.broken && !state.short;
  if (landed) {
    const x = toX(place.x);
    ctx.fillRect(x - 2, lane - Math.round(ppm * 0.6), 4, Math.round(ppm * 0.6));
  }

  const flying = place.u !== null && place.u < 1 && !state.finished;
  const pose = landed
    ? SQUAT
    : state.foul || state.broken
      ? POSES.stand
      : place.u !== null
        ? boundPose(state.phase, place.u)
        : hurdlerPose(place.x * HURDLE_PX_PER_M, null);
  const face = landed ? "joy" : flying || state.hold > 10 ? "effort" : "neutral";
  drawMascot(ctx, pose, {
    paint: PAINT,
    bones: BONES[face],
    at: { x: toX(place.x), y: lane - hipAboveFoot(pose) * scale - place.lift * ppm },
    scale,
  });
};
