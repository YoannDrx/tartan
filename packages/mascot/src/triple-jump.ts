// Le triple saut : cloche-pied, foulée bondissante, saut. Le même pied deux fois, puis l'autre, puis le sable.
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
import type { Anchor, Point, Pose } from "./skeleton";

const STAGE = { width: 1400, height: 800, ground: 740 };
const HIP = hipOn(STAGE.ground);
const ANKLE = STAGE.ground - 16;
const START = 70;
// Deux appuis lancés : au dernier, la jambe d'appel passe devant.
const RUN_END = 310;
// La planche est loin de la fosse : les deux premiers bonds retombent sur la piste.
export const TRIPLE_JUMP = { foul: 408, hop: 640, step: 852, pit: { from: 930, to: 1380 }, heel: 1196 };

const AT = {
  run: 0.07,
  runEnd: 0.27,
  plant: 0.3,
  takeoff: 0.33,
  hopLand: 0.46,
  hopOff: 0.49,
  stepLand: 0.61,
  stepOff: 0.64,
  apex: 0.705,
  touch: 0.79,
  crouch: 0.825,
  squat: 0.87,
  cheer: 0.94,
};

const run = (t: number): Frame =>
  runFrame(mix(START, RUN_END, cruise((t - AT.run) / (AT.runEnd - AT.run), 0.3)), START, HIP);

const HEEL: Point = { x: TRIPLE_JUMP.heel, y: ANKLE + 8 };

const pin = (t: number, anchor: Anchor, foot: Point, patch: Partial<Pose>): Moment => {
  const pose = { ...POSES.stand, ...patch };
  return { t, pose, root: pinned(pose, anchor, foot) };
};

// Un appui qui encaisse, puis qui renvoie. `side` : le pied au sol ; l'autre genou monte.
const contact = (
  land: number,
  off: number,
  side: "A" | "B",
  at: number,
  arms: { land: Partial<Pose>; off: Partial<Pose> },
): Moment[] => {
  const other = side === "A" ? "B" : "A";
  const leg = (own: number, ownKnee: number, free: number, freeKnee: number): Partial<Pose> => ({
    [`leg${side}`]: own,
    [`knee${side}`]: ownKnee,
    [`leg${other}`]: free,
    [`knee${other}`]: freeKnee,
  });
  return [
    pin(
      land,
      `foot${side}`,
      { x: at, y: ANKLE },
      { rot: -4, sx: 1.06, sy: 0.92, lean: 4, ...leg(22, 26, -22, 96), ...arms.land },
    ),
    pin(
      off,
      `foot${side}`,
      { x: at + 4, y: ANKLE - 8 },
      { rot: 6, sx: 0.94, sy: 1.1, lean: 2, head: -4, ...leg(-22, 6, 86, 98), ...arms.off },
    ),
  ];
};

const KEYS: Moment[] = [
  ...runIn(AT.runEnd, run),
  pin(
    AT.plant,
    "footA",
    { x: TRIPLE_JUMP.foul - 14, y: ANKLE },
    {
      rot: -6,
      sx: 1.05,
      sy: 0.93,
      lean: -2,
      armA: -48,
      elbowA: 44,
      armB: 44,
      elbowB: 60,
      legA: 24,
      kneeA: 6,
      legB: -28,
      kneeB: 76,
    },
  ),
  pin(
    AT.takeoff,
    "footA",
    { x: TRIPLE_JUMP.foul - 10, y: ANKLE - 8 },
    {
      rot: 6,
      sx: 0.95,
      sy: 1.08,
      head: -4,
      armA: 100,
      elbowA: 30,
      armB: -34,
      elbowB: 50,
      legA: -22,
      kneeA: 8,
      legB: 80,
      kneeB: 96,
    },
  ),
  // Cloche-pied : la jambe d'appel repasse sous le corps pour retomber la première.
  moment(
    0.385,
    { x: 522, y: HIP - 96 },
    { lean: 6, armA: 24, elbowA: 60, armB: 56, elbowB: 50, legA: 38, kneeA: 112, legB: 8, kneeB: 58 },
  ),
  moment(
    0.43,
    { x: 590, y: HIP - 52 },
    { rot: -4, lean: 4, armA: -50, elbowA: 40, armB: 70, elbowB: 40, legA: 60, kneeA: 22, legB: -38, kneeB: 72 },
  ),
  ...contact(AT.hopLand, AT.hopOff, "A", TRIPLE_JUMP.hop, {
    land: { armA: -34, elbowA: 50, armB: 34, elbowB: 60 },
    off: { armA: 104, elbowA: 30, armB: -36, elbowB: 50 },
  }),
  // Foulée bondissante : le genou tenu haut, le temps de la suspension.
  moment(
    0.55,
    { x: 752, y: HIP - 84 },
    { lean: 8, armA: 60, elbowA: 34, armB: -52, elbowB: 40, legA: -50, kneeA: 62, legB: 88, kneeB: 92 },
  ),
  moment(
    0.59,
    { x: 818, y: HIP - 40 },
    { rot: -4, lean: 2, armA: -58, elbowA: 30, armB: -50, elbowB: 30, legA: -28, kneeA: 92, legB: 52, kneeB: 18 },
  ),
  ...contact(AT.stepLand, AT.stepOff, "B", TRIPLE_JUMP.step, {
    land: { armA: -44, elbowA: 30, armB: -40, elbowB: 30 },
    off: { armA: 150, elbowA: 14, armB: 140, elbowB: 16 },
  }),
  // Saut : les deux bras au ciel, puis les jambes ramenées devant.
  moment(
    AT.apex,
    { x: 1000, y: HIP - 150 },
    {
      rot: -4,
      lean: -12,
      head: -8,
      armA: 172,
      elbowA: 8,
      armB: 160,
      elbowB: 10,
      legA: -12,
      kneeA: 72,
      legB: -20,
      kneeB: 72,
    },
  ),
  moment(
    0.755,
    { x: 1076, y: HIP - 96 },
    {
      rot: -14,
      lean: 28,
      head: 6,
      armA: 104,
      elbowA: 4,
      armB: 96,
      elbowB: 4,
      legA: 70,
      kneeA: 28,
      legB: 76,
      kneeB: 32,
    },
  ),
  ...sandLanding(AT, HEEL),
];
const JUMP = tracks(KEYS);

// Les trois appuis au sol : le pied posé ne glisse pas tant que l'impulsion n'est pas donnée.
const CONTACTS: Array<{ from: number; to: number; anchor: Anchor; at: number }> = [
  { from: AT.plant, to: AT.takeoff, anchor: "footA", at: TRIPLE_JUMP.foul - 14 },
  { from: AT.hopLand, to: AT.hopOff, anchor: "footA", at: TRIPLE_JUMP.hop },
  { from: AT.stepLand, to: AT.stepOff, anchor: "footB", at: TRIPLE_JUMP.step },
];

export const TRIPLE_JUMP_TIMES = AT;

const READY: Pose = { ...POSES.stand, rot: 6, lean: 8, legA: 20, kneeA: 26, legB: -16, kneeB: 22 };

const frame = (t: number): Frame => {
  if (t <= AT.run) {
    const u = smooth(0.02, AT.run, t);
    return { pose: blend(POSES.stand, READY, u), root: { x: START, y: mix(HIP, run(AT.run).root.y, u) } };
  }
  if (t < AT.runEnd) {
    const frame = run(t);
    const u = smooth(AT.run, AT.run + 0.03, t);
    return u >= 1 ? frame : { pose: blend(READY, frame.pose, u), root: frame.root };
  }
  const jump = JUMP.frame(t);
  for (const { from, to, anchor, at } of CONTACTS) {
    if (t < from || t > to) continue;
    const u = (t - from) / (to - from);
    return planted(jump.pose, anchor, { x: at, y: ANKLE }, { x: at + 4, y: ANKLE - 8 }, u);
  }
  return t < AT.touch ? jump : sandFrame(jump.pose, t, AT, HEEL);
};

const PHASES: Phase[] = [
  { name: "ready", from: 0, to: AT.run },
  { name: "approach", from: AT.run, to: AT.runEnd },
  { name: "takeoff", from: AT.runEnd, to: AT.takeoff },
  { name: "hop", from: AT.takeoff, to: AT.hopOff },
  { name: "step", from: AT.hopOff, to: AT.stepOff },
  { name: "jump", from: AT.stepOff, to: AT.touch },
  { name: "landing", from: AT.touch, to: AT.squat },
  { name: "celebrate", from: AT.squat, to: 1 },
];

const PROPS: PropShape[] = [
  laneLine(STAGE, 0, TRIPLE_JUMP.pit.from),
  ...takeoffBoard(STAGE, TRIPLE_JUMP.foul),
  ...sandPit(STAGE, TRIPLE_JUMP.pit.from, TRIPLE_JUMP.pit.to),
];

export const TRIPLE_JUMP_CLIP: EventClip = {
  id: "tripleJump",
  stage: STAGE,
  duration: 4400,
  phases: PHASES,
  still: 0.55,
  frame: (t) => frame(clamp(t)),
  props: () => PROPS,
  face: faceBy(AT.run, AT.squat),
};
