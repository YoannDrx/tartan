// Le saut en longueur : la vitesse de l'élan, un appel sur la planche, la suspension, puis les talons loin devant.
import { blend, clamp, mix, smooth, type Frame } from "./clip";
import {
  cruise,
  faceBy,
  hipOn,
  laneLine,
  moment,
  pinned,
  planted,
  runFrame,
  runIn,
  sandFrame,
  sandLanding,
  sandPit,
  takeoffBoard,
  tracks,
  type EventClip,
  type Moment,
  type Phase,
} from "./event";
import { POSES } from "./poses";
import type { PropShape } from "./props";
import type { Point, Pose } from "./skeleton";

const STAGE = { width: 1400, height: 800, ground: 740 };
const HIP = hipOn(STAGE.ground);
const ANKLE = STAGE.ground - 16;
const START = 90;
// Quatre appuis : au dernier, la jambe d'appel passe devant.
const RUN_END = 570;
// La ligne à ne pas mordre, et la fosse.
export const LONG_JUMP = { foul: 708, pit: { from: 800, to: 1370 }, heel: 1172 };

const AT = {
  run: 0.08,
  runEnd: 0.42,
  plant: 0.455,
  takeoff: 0.49,
  apex: 0.59,
  touch: 0.71,
  crouch: 0.75,
  squat: 0.8,
  cheer: 0.89,
};

const run = (t: number): Frame =>
  runFrame(mix(START, RUN_END, cruise((t - AT.run) / (AT.runEnd - AT.run), 0.22)), START, HIP);

const HEEL: Point = { x: LONG_JUMP.heel, y: ANKLE + 8 };

// Le pied d'appel sur la planche : à plat, puis le talon décollé.
const PLANT: Point = { x: LONG_JUMP.foul - 10, y: ANKLE };
const PUSH: Point = { x: LONG_JUMP.foul - 8, y: ANKLE - 8 };

const pin = (t: number, foot: Point, patch: Partial<Pose>): Moment => {
  const pose = { ...POSES.stand, ...patch };
  return { t, pose, root: pinned(pose, "footA", foot) };
};

const KEYS: Moment[] = [
  ...runIn(AT.runEnd, run),
  // Dernier appui : le pied à plat sur la planche, le bassin encore derrière lui.
  pin(AT.plant, PLANT, {
    rot: -8,
    sx: 1.06,
    sy: 0.92,
    lean: -4,
    head: 4,
    armA: -52,
    elbowA: 42,
    armB: 44,
    elbowB: 62,
    legA: 26,
    kneeA: 6,
    legB: -30,
    kneeB: 74,
  }),
  // Appel : le genou libre monte, le bras opposé avec lui.
  pin(AT.takeoff, PUSH, {
    rot: 6,
    sx: 0.94,
    sy: 1.1,
    lean: 2,
    head: -4,
    armA: 114,
    elbowA: 28,
    armB: -36,
    elbowB: 48,
    legA: -20,
    kneeA: 6,
    legB: 86,
    kneeB: 96,
  }),
  moment(
    0.535,
    { x: 836, y: 498 },
    {
      rot: -2,
      lean: -8,
      head: -6,
      armA: 150,
      elbowA: 14,
      armB: 96,
      elbowB: 20,
      legA: -34,
      kneeA: 52,
      legB: 44,
      kneeB: 96,
    },
  ),
  // Suspension : le dos cambré, les bras au ciel, les jambes à la traîne.
  moment(
    AT.apex,
    { x: 925, y: 442 },
    {
      rot: -6,
      lean: -14,
      head: -10,
      armA: 172,
      elbowA: 8,
      armB: 158,
      elbowB: 10,
      legA: -24,
      kneeA: 74,
      legB: -6,
      kneeB: 84,
    },
  ),
  // Ramené : les jambes passent devant, le buste se referme dessus.
  moment(
    0.65,
    { x: 1012, y: 488 },
    {
      rot: -14,
      lean: 26,
      head: 6,
      armA: 112,
      elbowA: 4,
      armB: 102,
      elbowB: 4,
      legA: 66,
      kneeA: 30,
      legB: 74,
      kneeB: 34,
    },
  ),
  ...sandLanding(AT, HEEL),
];
const JUMP = tracks(KEYS);

export const LONG_JUMP_TIMES = AT;

const READY: Pose = { ...POSES.stand, rot: 6, lean: 8, legA: 20, kneeA: 26, legB: -16, kneeB: 22 };

const frame = (t: number): Frame => {
  if (t <= AT.run) {
    const u = smooth(0.02, AT.run, t);
    const first = run(AT.run);
    return { pose: blend(POSES.stand, READY, u), root: { x: START, y: mix(HIP, first.root.y, u) } };
  }
  if (t < AT.runEnd) {
    const frame = run(t);
    const u = smooth(AT.run, AT.run + 0.03, t);
    return u >= 1 ? frame : { pose: blend(READY, frame.pose, u), root: frame.root };
  }
  const jump = JUMP.frame(t);
  if (t >= AT.plant && t <= AT.takeoff) {
    return planted(jump.pose, "footA", PLANT, PUSH, (t - AT.plant) / (AT.takeoff - AT.plant));
  }
  return t < AT.touch ? jump : sandFrame(jump.pose, t, AT, HEEL);
};

const PHASES: Phase[] = [
  { name: "ready", from: 0, to: AT.run },
  { name: "approach", from: AT.run, to: AT.runEnd },
  { name: "takeoff", from: AT.runEnd, to: AT.takeoff },
  { name: "flight", from: AT.takeoff, to: AT.touch },
  { name: "landing", from: AT.touch, to: AT.squat },
  { name: "celebrate", from: AT.squat, to: 1 },
];

const PROPS: PropShape[] = [
  laneLine(STAGE, 0, LONG_JUMP.pit.from),
  ...takeoffBoard(STAGE, LONG_JUMP.foul),
  ...sandPit(STAGE, LONG_JUMP.pit.from, LONG_JUMP.pit.to),
];

export const LONG_JUMP_CLIP: EventClip = {
  id: "longJump",
  stage: STAGE,
  duration: 3600,
  phases: PHASES,
  still: AT.apex,
  frame: (t) => frame(clamp(t)),
  props: () => PROPS,
  face: faceBy(AT.run, AT.squat),
};
