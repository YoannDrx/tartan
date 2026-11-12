import { athletePaint, stagePaint } from "@tartan/design-tokens/athletes";
import { tokens } from "@tartan/design-tokens";
import { BOARD_X, UNITS_PER_MM, type LongJumpState } from "@tartan/game/events/long-jump";
import { athleteRig } from "@tartan/mascot/athletes";
import { drawMascot } from "@tartan/mascot/canvas";
import { HURDLE_PX_PER_M, hurdlerHipAbove as hipAboveFoot, hurdlerPose } from "@tartan/mascot/hurdles";
import { LONG_JUMP_CLIP, LONG_JUMP_TIMES } from "@tartan/mascot/long-jump";
import { POSES } from "@tartan/mascot/poses";
import { pixelsPerMetre, type SceneSize } from "./hurdles-scene";

// Une image du saut en longueur : la piste d'élan, la planche, le sable, et Lila. Comme pour les haies, une
// fonction de l'état de la simulation, qui ne garde rien d'une image à l'autre.

const PAINT = athletePaint("longJump", "piste");
const PROPS = stagePaint("piste");
const BONES = {
  neutral: athleteRig("longJump", "neutral"),
  effort: athleteRig("longJump", "effort"),
  joy: athleteRig("longJump", "joy"),
};
const BOARD_M = BOARD_X / UNITS_PER_MM / 1000;
const PIT = { from: BOARD_M + 1, to: BOARD_M + 10 };

// La pose du geste à l'instant `u` du vol (0 à l'appel, 1 au contact du sable).
const flightPose = (u: number) =>
  LONG_JUMP_CLIP.frame(LONG_JUMP_TIMES.takeoff + (LONG_JUMP_TIMES.touch - LONG_JUMP_TIMES.takeoff) * u).pose;
const SQUAT = LONG_JUMP_CLIP.frame(LONG_JUMP_TIMES.squat).pose;

// Où est Lila, en mètres, et à quelle hauteur sont ses pieds, en mètres.
const placeOf = (state: LongJumpState): { x: number; lift: number; flight: number | null } => {
  if (state.takeoffX < 0) return { x: state.x / UNITS_PER_MM / 1000, lift: 0, flight: null };
  const from = state.takeoffX / UNITS_PER_MM / 1000;
  const total = Math.max(1, state.flightTicks);
  const u = Math.min(1, state.air / total);
  const lift = (4 * state.peak * u * (1 - u)) / 1000;
  return { x: from + (state.flight / 1000) * u, lift, flight: state.finished ? null : u };
};

export const drawLongJump = (
  ctx: CanvasRenderingContext2D,
  size: SceneSize,
  state: LongJumpState,
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

  // Le sable, sous la ligne du couloir, puis les deux lignes blanches.
  ctx.fillStyle = PROPS.sand;
  ctx.fillRect(toX(PIT.from), lane - 4, (PIT.to - PIT.from) * ppm, Math.round(ppm * 0.9) + 8);
  ctx.fillStyle = tokens.band.lane;
  ctx.fillRect(0, lane, Math.max(0, Math.min(width, toX(PIT.from))), 3);
  ctx.fillRect(Math.max(0, toX(PIT.to)), lane, width, 3);
  ctx.fillRect(0, lane + Math.round(ppm * 0.9), width, 3);

  // La planche blanche, et la bande de plasticine juste après : y laisser la trace, c'est mordre.
  ctx.fillStyle = PROPS.board;
  ctx.fillRect(toX(BOARD_M - 0.2), lane - 3, 0.2 * ppm, 7);
  ctx.fillStyle = PROPS.foul;
  ctx.fillRect(toX(BOARD_M), lane - 3, 0.1 * ppm, 7);

  // Les repères : la distance à la planche sur l'élan, la marque dans le sable.
  ctx.font = `600 ${Math.round(Math.max(12, ppm * 0.3))}px ${family}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = tokens.band.lane;
  for (let mark = 5; mark <= 9; mark += 1) {
    const x = toX(BOARD_M + mark);
    if (x < -ppm || x > width + ppm) continue;
    ctx.fillRect(x - 1, lane + Math.round(ppm * 0.2), 2, Math.round(ppm * 0.5));
    ctx.fillText(label(mark), x + 6, lane + Math.round(ppm * 0.45));
  }

  // La marque, une fois dans le sable : un piquet blanc là où le corps a touché.
  if (state.finished && !state.foul && !state.short && state.takeoffX >= 0) {
    const x = toX(place.x);
    ctx.fillRect(x - 2, lane - Math.round(ppm * 0.6), 4, Math.round(ppm * 0.6));
  }

  const flying = place.flight !== null;
  const landed = state.finished && !state.foul && state.takeoffX >= 0;
  const pose = flying
    ? flightPose(place.flight!)
    : landed
      ? SQUAT
      : state.foul
        ? POSES.stand
        : hurdlerPose(place.x * HURDLE_PX_PER_M, null);
  const face = landed ? "joy" : flying || state.hold > 10 ? "effort" : "neutral";
  drawMascot(ctx, pose, {
    paint: PAINT,
    bones: BONES[face],
    at: { x: toX(place.x), y: lane - hipAboveFoot(pose) * scale - place.lift * ppm },
    scale,
  });
};
