// Le saut à la perche : la course perche en main, le piqué, la perche qui plie puis renvoie, et la barre franchie pieds devant.
import { blend, clamp, mix, sample, smooth, type Frame } from "./clip";
import {
  cruise,
  faceBy,
  hipOn,
  laneLine,
  moment,
  pinned,
  runFrame,
  runIn,
  tracks,
  type EventClip,
  type Moment,
  type Phase,
} from "./event";
import { POSES } from "./poses";
import type { PropShape } from "./props";
import { jointPositions, type Point, type Pose } from "./skeleton";

const STAGE = { width: 1400, height: 900, ground: 840 };
const HIP = hipOn(STAGE.ground);
const START = 90;
// Trois appuis et demi : au dernier, la jambe d'appel est derrière, prête à pousser.
const RUN_END = 510;
const MAT_TOP = STAGE.ground - 150;

// Le butoir où la perche se plante, la longueur de perche entre le butoir et la main du haut, la barre.
export const POLE_VAULT = {
  box: { x: 860, y: STAGE.ground + 8 },
  grip: 440,
  bar: { far: { x: 940, y: 326 }, near: { x: 1080, y: 298 } },
  mat: { from: 930, to: 1390, top: MAT_TOP },
};
const { box, grip, bar, mat } = POLE_VAULT;

const AT = {
  run: 0.07,
  runEnd: 0.36,
  plant: 0.4,
  swing: 0.455,
  rock: 0.51,
  invert: 0.56,
  push: 0.61,
  release: 0.64,
  over: 0.685,
  clear: 0.73,
  impact: 0.8,
  up: 0.945,
  cheer: 0.97,
};

// La perche se porte la pointe haute, puis s'abaisse vers le butoir : la main arrière monte, la main avant descend.
const carry = (lowering: number): Partial<Pose> => ({
  rot: 6,
  armB: mix(-30, -54, lowering),
  elbowB: mix(60, 106, lowering),
  armA: mix(50, 26, lowering),
  elbowA: mix(70, 24, lowering),
});
const run = (t: number): Frame => {
  const u = clamp((t - AT.run) / (AT.runEnd - AT.run));
  const frame = runFrame(mix(START, RUN_END, cruise(u, 0.22)), START, HIP, Math.PI);
  return { pose: { ...frame.pose, ...carry(smooth(0.45, 1, u)) }, root: frame.root };
};

// Où est la main du haut, vue du butoir : un angle au-dessus du sol (90° : à la verticale) et une distance.
const from = (angle: number, distance: number): Point => ({
  x: box.x + distance * Math.cos((angle * Math.PI) / 180),
  y: box.y - distance * Math.sin((angle * Math.PI) / 180),
});
const hang = (t: number, angle: number, distance: number, patch: Partial<Pose>): Moment => {
  const pose = { ...POSES.stand, ...patch };
  return { t, pose, root: pinned(pose, "handB", from(angle, distance)) };
};

// Sur le dos, les jambes en l'air : la réception et ses rebonds dans le tapis.
const IMPACT: Point = { x: 1172, y: MAT_TOP - 45 };
const legsUp = (t: number, dx: number, dy: number, rot: number, sx: number, sy: number) =>
  moment(t, { x: IMPACT.x + dx, y: IMPACT.y + dy }, { ...POSES.landing, rot, flip: -1, sx, sy });

const KEYS: Moment[] = [
  ...runIn(AT.runEnd, run),
  // Piqué : les deux bras au-dessus de la tête, la jambe d'appel pousse, le genou libre monte.
  hang(AT.plant, 130, 422, {
    rot: 4,
    head: -8,
    armB: 172,
    elbowB: 6,
    armA: 138,
    elbowA: 34,
    legA: -18,
    kneeA: 6,
    legB: 72,
    kneeB: 92,
  }),
  // Balancer : pendu à la perche qui plie, la jambe d'appel fouette vers l'avant.
  hang(AT.swing, 122, 404, {
    rot: -24,
    lean: -6,
    head: -4,
    armB: 176,
    elbowB: 4,
    armA: 150,
    elbowA: 26,
    legA: 16,
    kneeA: 12,
    legB: 72,
    kneeB: 84,
  }),
  // Groupé : le dos au sol, les genoux vers les mains. La perche est au plus plié.
  hang(AT.rock, 110, 350, {
    rot: -85,
    lean: 16,
    head: 10,
    armB: 104,
    elbowB: 0,
    armA: 84,
    elbowA: 30,
    legA: 76,
    kneeA: 58,
    legB: 88,
    kneeB: 66,
  }),
  // Renversé : le corps à la verticale, tête en bas, le long de la perche qui se redresse.
  hang(AT.invert, 95, 405, {
    rot: -150,
    lean: 6,
    armB: 62,
    elbowB: 6,
    armA: 40,
    elbowA: 30,
    legA: 8,
    kneeA: 4,
    legB: 14,
    kneeB: 8,
  }),
  // Retournement : le ventre se tourne vers la barre pendant que les bras repoussent la perche.
  hang(AT.push, 88, 432, {
    rot: -176,
    flip: 0.45,
    armB: 122,
    elbowB: 4,
    armA: 100,
    elbowA: 20,
    legA: 4,
    kneeA: 4,
    legB: 8,
    kneeB: 6,
  }),
  hang(AT.release, 80, 440, {
    rot: -178,
    flip: -0.45,
    armB: 176,
    elbowB: 2,
    armA: 150,
    elbowA: 10,
    legA: 6,
    kneeA: 4,
    legB: 10,
    kneeB: 6,
  }),
  // Franchissement : le bassin au-dessus de la barre, les jambes déjà de l'autre côté, le buste encore de celui-ci.
  moment(
    AT.over,
    { x: 1010, y: 212 },
    {
      rot: -110,
      flip: -1,
      lean: 46,
      head: 10,
      armA: 150,
      elbowA: 10,
      armB: 160,
      elbowB: 10,
      legA: 30,
      kneeA: 6,
      legB: 36,
      kneeB: 8,
    },
  ),
  // Esquive : les bras partent en arrière pour ne pas accrocher la barre.
  moment(
    AT.clear,
    { x: 1108, y: 280 },
    {
      rot: -55,
      flip: -1,
      lean: 12,
      head: -10,
      armA: 168,
      elbowA: 8,
      armB: 150,
      elbowB: 8,
      legA: 40,
      kneeA: 20,
      legB: 30,
      kneeB: 30,
    },
  ),
  moment(0.765, { x: 1136, y: 440 }, { ...POSES.landing, rot: 40, flip: -1, armA: 120, armB: 100, legA: 60, legB: 70 }),
  legsUp(AT.impact, 0, 0, 150, 1.26, 0.7),
  legsUp(0.813, 6, 7, 154, 1.34, 0.62),
  legsUp(0.852, 18, -120, 162, 0.92, 1.12),
  legsUp(0.887, 30, 0, 156, 1.18, 0.78),
  legsUp(0.91, 36, -25, 174, 1, 1),
  moment(
    AT.up,
    { x: IMPACT.x + 40, y: MAT_TOP - 140 },
    {
      rot: 360,
      flip: -1,
      sx: 1.1,
      sy: 0.9,
      lean: 2,
      armA: 92,
      elbowA: 40,
      armB: -74,
      elbowB: -40,
      legA: 10,
      kneeA: 18,
      legB: -6,
      kneeB: 16,
    },
  ),
  // Debout sur le tapis, face à la barre restée en place.
  moment(AT.cheer, { x: IMPACT.x + 40, y: MAT_TOP - 146 }, { ...POSES.cheer, rot: 360, flip: -1, sx: 0.96, sy: 1.06 }),
  moment(1.1, { x: IMPACT.x + 40, y: MAT_TOP - 144 }, { ...POSES.cheer, rot: 360, flip: -1 }),
];
const VAULT = tracks(KEYS);

const READY: Pose = { ...POSES.stand, ...carry(0), rot: 2 };

const frame = (t: number): Frame => {
  if (t <= AT.run) {
    const first = run(AT.run);
    return { pose: READY, root: { x: START, y: mix(HIP, first.root.y, smooth(0.02, AT.run, t)) } };
  }
  if (t < AT.runEnd) {
    const frame = run(t);
    const u = smooth(AT.run, AT.run + 0.03, t);
    return u >= 1 ? frame : { pose: blend(READY, frame.pose, u), root: frame.root };
  }
  return VAULT.frame(t);
};

// La perche : portée, elle prolonge la ligne des deux mains ; plantée, elle va du butoir à la main du haut
// et plie d'autant que cette main s'en rapproche ; lâchée, elle retombe en arrière.
const FALL = [
  { t: AT.release, v: { angle: 80 } },
  { t: 0.74, v: { angle: 96 } },
  { t: 0.86, v: { angle: 150 } },
  { t: 0.9, v: { angle: 160 } },
];
export const poleAt = (t: number): { from: Point; control: Point; to: Point } => {
  const straight = (a: Point, b: Point) => ({ from: a, control: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, to: b });
  if (t > AT.release) return straight(box, from(sample(FALL, t).angle, grip));
  const { pose, root } = frame(t);
  const hands = jointPositions(pose, root);
  if (t < AT.plant) {
    const along = Math.hypot(hands.handA.x - hands.handB.x, hands.handA.y - hands.handB.y) || 1;
    const tip = {
      x: hands.handB.x + ((hands.handA.x - hands.handB.x) / along) * grip,
      y: hands.handB.y + ((hands.handA.y - hands.handB.y) / along) * grip,
    };
    // La pointe glisse dans le butoir sur les derniers appuis.
    const u = smooth(AT.runEnd - 0.03, AT.plant, t);
    return straight({ x: mix(tip.x, box.x, u), y: mix(tip.y, box.y, u) }, hands.handB);
  }
  const top = hands.handB;
  const chord = Math.hypot(top.x - box.x, top.y - box.y);
  // La flèche d'un arc de longueur `grip` tendu sur cette corde ; le point de contrôle est deux fois plus loin.
  const sag = Math.sqrt((Math.max(0, grip - chord) * 3 * chord) / 8);
  const middle = { x: (box.x + top.x) / 2, y: (box.y + top.y) / 2 };
  // La perche bombe du côté du tapis.
  const normal = { x: -(top.y - box.y) / chord, y: (top.x - box.x) / chord };
  return { from: box, control: { x: middle.x + normal.x * 2 * sag, y: middle.y + normal.y * 2 * sag }, to: top };
};

// La distance du butoir à la main du haut, tant que la perche est tenue : elle ne dépasse pas la perche.
export const poleChord = (t: number) => {
  const { pose, root } = frame(t);
  const top = jointPositions(pose, root).handB;
  return Math.hypot(top.x - box.x, top.y - box.y);
};
export const POLE_VAULT_TIMES = AT;

const PHASES: Phase[] = [
  { name: "ready", from: 0, to: AT.run },
  { name: "approach", from: AT.run, to: AT.runEnd },
  { name: "plant", from: AT.runEnd, to: AT.plant },
  { name: "swing", from: AT.plant, to: AT.push },
  { name: "clearance", from: AT.push, to: AT.clear },
  { name: "landing", from: AT.clear, to: AT.up },
  { name: "celebrate", from: AT.up, to: 1 },
];

const GROUND: PropShape[] = [
  laneLine(STAGE, 0, mat.from - 30),
  {
    kind: "line",
    from: { x: bar.far.x, y: mat.top + 10 },
    to: { x: bar.far.x, y: bar.far.y - 24 },
    width: 10,
    paint: "post",
  },
  { kind: "rect", x: mat.from + 18, y: mat.top, width: mat.to - mat.from - 18, height: 44, radius: 8, paint: "matTop" },
  // Le liseré blanc du dessus : il détache le sautoir de la piste rouge.
  {
    kind: "line",
    from: { x: mat.from + 26, y: mat.top + 2 },
    to: { x: mat.to - 8, y: mat.top + 2 },
    width: 5,
    cap: "butt",
    paint: "board",
  },
  { kind: "rect", x: mat.from, y: mat.top + 38, width: mat.to - mat.from, height: 172, radius: 8, paint: "mat" },
  { kind: "line", from: bar.far, to: bar.near, width: 9, paint: "bar" },
];
// Le poteau proche passe devant le perchiste : il est entre lui et nous.
const NEAR: PropShape[] = [
  {
    kind: "line",
    from: { x: bar.near.x, y: STAGE.ground + 50 },
    to: { x: bar.near.x, y: bar.near.y - 28 },
    width: 16,
    paint: "post",
    front: true,
  },
  {
    kind: "rect",
    x: bar.near.x - 46,
    y: STAGE.ground + 44,
    width: 92,
    height: 16,
    radius: 8,
    paint: "post",
    front: true,
  },
];
const props = (t: number): PropShape[] => [
  ...GROUND,
  { kind: "curve", ...poleAt(clamp(t)), width: 9, paint: "pole" },
  ...NEAR,
];

export const POLE_VAULT_CLIP: EventClip = {
  id: "poleVault",
  stage: STAGE,
  duration: 4800,
  phases: PHASES,
  still: AT.rock,
  frame: (t) => frame(clamp(t)),
  props,
  face: faceBy(AT.run, AT.up),
};
