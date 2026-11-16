// Les gestes qui se lisent de face : déplacements de côté, élévations latérales, gainage et ouverture couchés sur le
// côté, mobilité assise. Vu de face, un angle positif écarte le membre du corps des deux côtés (skeleton.ts) : le
// côté A est à droite de l'image, le côté B à gauche. Couché sur le côté (rotation de −90°), la tête est à gauche,
// le côté A en haut et le côté B au sol. Mêmes athlètes que de profil, par famille.
import {
  air,
  dumbbell,
  exercise,
  ground,
  GYM,
  MIDDLE,
  type ExerciseClip,
  type ExerciseDraft,
  type GearShape,
  type Position,
} from "../exercise";
import type { Anchor, Point } from "../skeleton";
import { settle, type PosePatch } from "./base";

const MEHDI = "discus" as const;
const NOE = "highJump" as const;
const AWA = "tripleJump" as const;
const LILA = "longJump" as const;

const front = (athlete: ExerciseDraft["athlete"], draft: Omit<ExerciseDraft, "athlete" | "facing">): ExerciseClip =>
  exercise({ athlete, facing: "front", batch: "face", ...draft });
const effort = (pose: PosePatch, extra: Omit<Position, "pose"> = {}): Position => ({ pose, face: "effort", ...extra });
const calm = (pose: PosePatch, extra: Omit<Position, "pose"> = {}): Position => ({ pose, ...extra });
const on = (anchor: Anchor, x = 0): Pick<Position, "on" | "at"> => ({ on: anchor, at: ground(anchor, x) });

// Debout de face : tous les angles sont donnés, la station de profil (POSES.stand) ne doit rien laisser.
const upright = (patch: PosePatch = {}): PosePatch => ({
  rot: 0,
  lean: 0,
  head: 0,
  armA: 8,
  elbowA: 6,
  armB: 8,
  elbowB: 6,
  legA: 3,
  kneeA: 0,
  legB: 3,
  kneeB: 0,
  ...patch,
});
const armsOut = (arm: number, elbow = 6): PosePatch => ({ armA: arm, elbowA: elbow, armB: arm, elbowB: elbow });
const legsOut = (leg: number, knee = 0): PosePatch => ({ legA: leg, kneeA: knee, legB: leg, kneeB: knee });
// Les mains jointes devant la poitrine.
const clasped: PosePatch = { armA: 26, elbowA: -104, armB: 26, elbowB: -104 };

// Une jambe fléchie (A) sous le bassin décalé, l'autre (B) tendue au loin : les deux pieds au sol.
const sideLunge = (bend: number, patch: PosePatch = {}): PosePatch =>
  settle(
    (spread) => upright({ lean: 6, ...clasped, legA: bend, kneeA: bend * 1.9, legB: spread, kneeB: 0, ...patch }),
    [5, 75],
    "footA",
    "footB",
    0,
    "front",
  );

// --- Force : Mehdi -------------------------------------------------------------------------------

const lateralLunge = front(MEHDI, {
  key: "lateral-lunge",
  positions: [
    calm(upright({ ...clasped, ...legsOut(5) }), on("footB", -30)),
    effort(sideLunge(34), on("footB", -150)),
    effort(sideLunge(46), on("footB", -150)),
    calm(upright({ ...clasped, ...legsOut(14) }), { ...on("footB", -150), hold: 0.3 }),
  ],
});

const withDumbbells = (_: unknown, joints: Record<Anchor, Point>): GearShape[] => [
  ...dumbbell(joints.handA),
  ...dumbbell(joints.handB),
];
const lateralRaise = front(MEHDI, {
  key: "lateral-raise",
  gear: withDumbbells,
  positions: [
    calm(upright({ ...armsOut(10, 12), ...legsOut(6) }), on("footA", 20)),
    effort(upright({ ...armsOut(62, 14), ...legsOut(6) }), on("footA", 20)),
    effort(upright({ ...armsOut(84, 14), ...legsOut(6) }), { ...on("footA", 20), hold: 0.6 }),
    calm(upright({ ...armsOut(40, 12), ...legsOut(6) }), on("footA", 20)),
  ],
});

// --- Pliométrie : Noé ----------------------------------------------------------------------------

// Sur une jambe : l'autre se replie derrière, croisée.
const skaterOnA = (bend: number) =>
  upright({ lean: -8, armA: 30, elbowA: 24, armB: 64, elbowB: 24, legA: 6, kneeA: bend, legB: -10, kneeB: 36 });
const skaterOnB = (bend: number) =>
  upright({ lean: 8, armA: 64, elbowA: 24, armB: 30, elbowB: 24, legA: -10, kneeA: 36, legB: 6, kneeB: bend });
const skaterBound = front(NOE, {
  key: "lateral-skater-bound",
  duration: 3200,
  positions: [
    calm(skaterOnA(16), on("footA", 120)),
    effort(upright({ ...armsOut(70, 20), ...legsOut(26, 10) }), { root: air(40, 0), hold: 0.2 }),
    effort(skaterOnB(26), on("footB", -120)),
    calm(skaterOnB(14), {
      ...on("footB", -120),
      via: [{ pose: upright({ ...armsOut(70, 20), ...legsOut(26, 10) }), root: air(40, 0) }],
    }),
  ],
});

// --- Gainage : Awa, couchée sur le côté ----------------------------------------------------------

const SIDE = -90;
// Sur l'avant-bras du dessous (B) : le coude sous l'épaule, l'avant-bras posé au sol vers la tête.
const forearm: PosePatch = { armB: 90, elbowB: -90, armA: 14, elbowA: 10 };
const plank = (sag: number) =>
  settle(
    (rot) => ({ rot, lean: sag, head: 0, ...forearm, legA: -sag, kneeA: 0, legB: sag, kneeB: 0 }),
    [-110, -40],
    "footB",
    "handB",
    0,
    "front",
  );
// Avant de se soulever : les jambes au sol, le buste relevé sur l'avant-bras, la hanche posée.
const lying = settle(
  (lean) => ({ rot: -88, lean, head: 0, ...forearm, legA: 0, kneeA: 0, legB: 0, kneeB: 0 }),
  [0, 80],
  "footB",
  "handB",
  0,
  "front",
);
const onFeet = on("footB", 150);
const sidePlank = front(AWA, {
  key: "side-plank",
  positions: [
    calm(lying, onFeet),
    effort(plank(4), onFeet),
    effort(plank(0), { ...onFeet, hold: 0.6 }),
    calm(plank(10), onFeet),
  ],
});
const sidePlankHipLift = front(AWA, {
  key: "side-plank-hip-lift",
  positions: [
    calm(plank(0), onFeet),
    calm(plank(30), onFeet),
    effort(plank(-2), onFeet),
    effort(plank(0), { ...onFeet, hold: 0.6 }),
  ],
});

// --- Coordination : Awa, entre deux plots ---------------------------------------------------------

const coneAt = (x: number): GearShape => ({
  kind: "poly",
  points: [
    { x: x - 15, y: GYM.ground + 4 },
    { x: x - 4, y: GYM.ground - 28 },
    { x: x + 4, y: GYM.ground - 28 },
    { x: x + 15, y: GYM.ground + 4 },
  ],
  paint: "cone",
});
const twoCones = () => [coneAt(MIDDLE - 220), coneAt(MIDDLE + 220)];
const ready = (spread: number, patch: PosePatch = {}) =>
  upright({ lean: 0, armA: 24, elbowA: -40, armB: 24, elbowB: -40, ...legsOut(spread, 8), ...patch });
const sideShuffle = front(AWA, {
  key: "cone-side-shuffle",
  duration: 3600,
  gear: twoCones,
  positions: [
    calm(ready(12), on("footB", -140)),
    effort(ready(22), on("footB", -110)),
    calm(ready(6), on("footA", 120)),
    effort(ready(20, { lean: -6 }), on("footA", 130)),
  ],
});

const carioca = front(AWA, {
  key: "carioca",
  duration: 3600,
  positions: [
    calm(upright({ ...armsOut(30, 20), ...legsOut(12) }), on("footA", 20)),
    calm(upright({ lean: 6, ...armsOut(34, 20), legA: 4, legB: -22, kneeB: 6 }), on("footA", 40)),
    calm(upright({ ...armsOut(30, 20), ...legsOut(12) }), on("footB", 0)),
    calm(upright({ lean: -6, ...armsOut(34, 20), legA: -22, kneeA: 6, legB: 4 }), on("footB", -20)),
  ],
});

// --- Escaliers : Awa, de côté, la volée monte vers la droite de l'image ----------------------------

const RISE = 30;
const RUN = 70;
const FIRST = MIDDLE - 20;
const flight: GearShape = {
  kind: "poly",
  points: [
    { x: FIRST, y: GYM.ground + 4 },
    ...Array.from({ length: 4 }, (_, i) => [
      { x: FIRST + i * RUN, y: GYM.ground - (i + 1) * RISE },
      { x: FIRST + (i + 1) * RUN, y: GYM.ground - (i + 1) * RISE },
    ]).flat(),
    { x: FIRST + 4 * RUN + 40, y: GYM.ground - 4 * RISE },
    { x: FIRST + 4 * RUN + 40, y: GYM.ground + 4 },
  ],
  paint: "step",
};
// Le pied posé sur la marche `n` (0 : le sol au pied de la volée).
const step = (anchor: Anchor, n: number, dx = 0): Pick<Position, "on" | "at"> => ({
  on: anchor,
  at: { x: (n ? FIRST + (n - 1) * RUN + RUN / 2 : FIRST - 40) + dx, y: GYM.ground - n * RISE - 16 },
});
const at = (x: number, n: number): Point => ({ x, y: GYM.ground - n * RISE - 16 });
const steady = armsOut(16, 20);
// Le pied A posé une marche plus haut que le pied B, sur le côté : la cuisse s'écarte, le genou se plie d'autant.
const upOne = settle(
  (knee) => upright({ ...steady, legA: 60, kneeA: knee, legB: 10 }),
  [30, 130],
  "footB",
  "footA",
  -RISE,
  "front",
);
const lateralStairs = front(AWA, {
  key: "lateral-stair-walk",
  gear: () => [flight],
  positions: [
    calm(upright({ ...steady, ...legsOut(6) }), { on: "footB", at: at(FIRST - 60, 0) }),
    calm(upOne, { on: "footB", at: at(FIRST - 50, 0) }),
    effort(upright({ ...steady, legA: 4, legB: 22, kneeB: 40 }), { on: "footA", at: at(FIRST + 50, 1) }),
    calm(upright({ ...steady, ...legsOut(4) }), { on: "footA", at: at(FIRST + 52, 1), hold: 0.7 }),
  ],
});
// Le pied éloigné (B) croise devant l'autre pour se poser sur la marche : la cuisse rentre vers l'intérieur.
const crossOver = settle(
  (knee) => upright({ lean: 6, ...steady, legA: 5, legB: -50, kneeB: knee }),
  [-90, 10],
  "footA",
  "footB",
  -RISE,
  "front",
);
const crossStairs = front(AWA, {
  key: "cross-step-stairs",
  gear: () => [flight],
  positions: [
    calm(upright({ ...steady, ...legsOut(6) }), { on: "footA", at: at(FIRST - 14, 0) }),
    calm(crossOver, { on: "footA", at: at(FIRST - 14, 0) }),
    effort(upright({ lean: -4, ...steady, legA: 24, kneeA: 40, legB: 4 }), { on: "footB", at: at(FIRST + 14, 1) }),
    calm(upright({ ...steady, ...legsOut(4) }), { on: "footB", at: at(FIRST + 16, 1), hold: 0.7 }),
  ],
});

// --- Échauffement et mobilité : Lila -------------------------------------------------------------

const jumpingJacks = front(LILA, {
  key: "jumping-jacks",
  duration: 2400,
  positions: [
    calm(upright({ ...armsOut(8, 6), ...legsOut(3) }), { ...on("footA", 0), hold: 0.3 }),
    effort(upright({ ...armsOut(110, 10), ...legsOut(16, 4) }), { root: air(26, 0), hold: 0.2 }),
    calm(upright({ ...armsOut(168, 6), ...legsOut(22, 6) }), { ...on("footA", 50), hold: 0.3 }),
    calm(upright({ ...armsOut(60, 10), ...legsOut(8, 4) }), { root: air(20, 0), hold: 0.2 }),
  ],
});

// L'élastique au-dessus des genoux : à mi-cuisse, entre les deux jambes.
const bandAboveKnees = (_: unknown, joints: Record<Anchor, Point>): GearShape[] => {
  const knee = (foot: Point, side: number) => ({
    x: joints.pelvis.x + side * 18 + (foot.x - joints.pelvis.x - side * 18) * 0.42,
    y: joints.pelvis.y + (foot.y - joints.pelvis.y) * 0.42,
  });
  return [
    { kind: "line", from: knee(joints.footB, -1), to: knee(joints.footA, 1), width: 9, paint: "band", front: true },
  ];
};
const athletic = (spread: number) => upright({ ...clasped, ...legsOut(spread, 6) });
const bandWalk = front(LILA, {
  key: "lateral-band-walk",
  gear: bandAboveKnees,
  positions: [
    calm(athletic(9), on("footB", -60)),
    effort(athletic(18), on("footB", -60)),
    calm(athletic(9), on("footA", 120)),
    effort(athletic(18), on("footA", 120)),
  ],
});

// Couchée sur le côté B, hanches et genoux fléchis : le genou du dessus s'ouvre, les pieds restent joints.
const shell = (open: number): PosePatch => ({
  rot: SIDE,
  lean: 0,
  head: -12,
  armB: 170,
  elbowB: 30,
  armA: 20,
  elbowA: -60,
  legA: -20 + open,
  kneeA: -50 + open * 1.6,
  legB: 20,
  kneeB: 50,
});
const onHip = { on: "pelvis" as const, at: { x: MIDDLE, y: GYM.ground - 40 } };
const clamshell = front(LILA, {
  key: "band-clamshell",
  gear: (_frame, joints) => [
    {
      kind: "line",
      from: { x: joints.pelvis.x + 52, y: joints.pelvis.y + 6 },
      to: { x: joints.pelvis.x + 52, y: joints.pelvis.y - 30 },
      width: 6,
      paint: "band",
      front: true,
    },
  ],
  positions: [
    calm(shell(0), onHip),
    calm(shell(16), onHip),
    effort(shell(30), { ...onHip, hold: 0.6 }),
    calm(shell(8), onHip),
  ],
});

// Assise au sol, genoux fléchis : les deux genoux basculent d'un côté puis de l'autre, en essuie-glace.
const seated = (swing: number): PosePatch => ({
  rot: 0,
  lean: -swing * 0.15,
  head: 0,
  armA: 30,
  elbowA: 20,
  armB: 30,
  elbowB: 20,
  legA: 104 - swing,
  kneeA: 140,
  legB: 104 + swing,
  kneeB: 140,
});
const onSeat = { on: "pelvis" as const, at: { x: MIDDLE, y: GYM.ground - 24 } };
const hip9090 = front(LILA, {
  key: "hip-90-90",
  duration: 5200,
  positions: [
    calm(seated(0), onSeat),
    calm(seated(44), { ...onSeat, hold: 0.6 }),
    calm(seated(0), onSeat),
    calm(seated(-44), { ...onSeat, hold: 0.6 }),
  ],
});

// Large écart, transfert du bassin vers un côté, talon au sol.
const cossack = front(LILA, {
  key: "cossack-mobility",
  duration: 5200,
  positions: [
    calm(upright({ ...clasped, ...legsOut(24) }), on("footB", -110)),
    calm(sideLunge(30), on("footB", -170)),
    calm(sideLunge(42), { ...on("footB", -170), hold: 0.6 }),
    calm(upright({ ...clasped, ...legsOut(22) }), on("footB", -110)),
  ],
});

// --- Couché, vu d'en haut ------------------------------------------------------------------------

// Rotation de hanche sur le ventre : vu d'en haut (de dos), la tête à gauche. Le tibia plié pointe vers le
// plafond ; il bascule vers l'extérieur puis vers l'intérieur.
const prone = (swing: number): PosePatch => ({
  rot: SIDE,
  lean: 0,
  head: 0,
  armA: 160,
  elbowA: 60,
  armB: 160,
  elbowB: 60,
  legA: 2,
  kneeA: 150 - swing,
  legB: 2,
  kneeB: 0,
});
const proneHipRotation = exercise({
  batch: "face",
  athlete: LILA,
  key: "prone-hip-rotation",
  facing: "back",
  duration: 5200,
  positions: [
    calm(prone(0), onHip),
    calm(prone(-60), { ...onHip, hold: 0.6 }),
    calm(prone(40), { ...onHip, hold: 0.6 }),
    calm(prone(0), onHip),
  ],
});

// --- De profil, couché ou à quatre appuis ------------------------------------------------------------

// Rotation thoracique : couchée sur le côté B, de face comme l'ouverture de hanche. Le bras du dessus, posé sur
// l'autre vers la tête, s'ouvre vers le plafond puis un peu au-delà, le regard suit la main.
const book = (open: number): PosePatch => ({
  ...shell(0),
  head: -12 + open * 0.3,
  armA: 172 - open,
  elbowA: 0,
  armB: 172,
  elbowB: 0,
});
const openBook = front(LILA, {
  key: "thoracic-open-book",
  duration: 5600,
  positions: [
    calm(book(0), onHip),
    calm(book(50), onHip),
    calm(book(110), { ...onHip, hold: 0.6 }),
    calm(book(40), onHip),
  ],
});

// Montée à quatre appuis : de profil, la volée monte vers la droite ; les mains deux marches plus haut que les pieds.
// `reach` : la main A et le pied B avancent ensemble, d'autant de degrés.
const bear = (reach = 0) =>
  settle(
    (rot) => ({
      rot,
      lean: 0,
      head: -20,
      armA: rot - 4 + reach,
      elbowA: reach / 2,
      armB: rot - 8,
      elbowB: 0,
      legA: rot - 24,
      kneeA: 34,
      legB: rot - 20 + reach,
      kneeB: 34 + reach,
    }),
    [20, 100],
    "handA",
    "footA",
    2 * RISE,
  );
const hands = (n: number): Pick<Position, "on" | "at"> => ({
  on: "handA",
  at: { x: FIRST + (n - 1) * RUN + RUN / 2, y: GYM.ground - n * RISE - 15 },
});
const bearCrawl = exercise({
  batch: "face",
  athlete: AWA,
  key: "stair-bear-crawl",
  duration: 4800,
  gear: () => [flight],
  positions: [
    calm(bear(), hands(2)),
    effort(bear(36), { on: "handB", at: { x: FIRST + RUN / 2 + RUN - 4, y: GYM.ground - 2 * RISE - 15 } }),
    calm(bear(), hands(3)),
    calm(bear(), { ...hands(3), hold: 0.7 }),
  ],
});

export const FRONT: readonly ExerciseClip[] = [
  lateralLunge,
  lateralRaise,
  skaterBound,
  sidePlank,
  sidePlankHipLift,
  sideShuffle,
  carioca,
  lateralStairs,
  crossStairs,
  jumpingJacks,
  bandWalk,
  clamshell,
  hip9090,
  cossack,
  proneHipRotation,
  openBook,
  bearCrawl,
];
