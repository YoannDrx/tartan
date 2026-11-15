// Coordination, escaliers et échauffement : Awa pour les plots et les escaliers, Lila pour l'échauffement.
// Les déplacements de côté (pas chassés, pas croisés, jumping jacks) se lisent de face et attendent ce point de vue.
import { mix, smooth } from "../clip";
import {
  air,
  exercise,
  GYM,
  MIDDLE,
  motion,
  STAND_ROOT,
  type ExerciseClip,
  type ExerciseDraft,
  type GearShape,
  type Position,
} from "../exercise";
import { POSES } from "../poses";
import type { Pose } from "../skeleton";
import { arms, legs, settle, type PosePatch } from "./base";
import { drill, stride, up } from "./running";

const AWA = "tripleJump" as const;
const LILA = "longJump" as const;
const TAU = Math.PI * 2;
const effort = (pose: PosePatch, extra: Omit<Position, "pose"> = {}): Position => ({ pose, face: "effort", ...extra });
const calm = (pose: PosePatch, extra: Omit<Position, "pose"> = {}): Position => ({ pose, ...extra });

// --- Plots ---------------------------------------------------------------------------------------

const coneAt = (x: number): GearShape => ({
  kind: "poly",
  points: [
    { x: x - 15, y: GYM.ground + 4 },
    { x: x - 4, y: GYM.ground - 28 },
    { x: x + 4, y: GYM.ground - 28 },
    { x: x + 15, y: GYM.ground + 4 },
  ],
  paint: "cone",
  scroll: true,
});
const cones = (every: number) => (travelled: number) => {
  const shift = ((travelled % every) + every) % every;
  return Array.from({ length: Math.ceil(GYM.width / every) + 2 }, (_, i) => coneAt(i * every - shift + every / 2));
};

// Des appuis rapides et courts : la fréquence plutôt que l'amplitude.
const quickFeet = (phase: number): Pose => ({
  ...POSES.stand,
  lean: 10,
  head: 2,
  legA: 14 + 18 * up(Math.sin(phase)),
  kneeA: 24 + 46 * up(Math.sin(phase)),
  legB: 14 + 18 * up(-Math.sin(phase)),
  kneeB: 24 + 46 * up(-Math.sin(phase)),
  armA: -30 * Math.sin(phase),
  elbowA: 84,
  armB: 30 * Math.sin(phase),
  elbowB: 84,
});
// En virage, le corps entier penche d'un côté puis de l'autre.
const weaving = (phase: number, pace: number, t: number): Pose => ({ ...stride(phase, pace), rot: 7 * Math.sin(t * TAU * 2) });
// Le recul : la course à l'envers, le buste un peu en arrière.
const backpedal = (phase: number): Pose => {
  const run = stride(-phase, 0.3);
  return { ...run, lean: -6, legA: 4 + (run.legA - 12) * 0.6, legB: 4 + (run.legB - 12) * 0.6 };
};

const coordination: ExerciseClip[] = [
  drill({ key: "cone-slalom", athlete: AWA, cycles: 6, distance: 1200, pace: [0.5, 0.6, 0.6, 0.5], pose: weaving, extra: cones(200) }),
  drill({ key: "square-footwork", athlete: AWA, cycles: 10, distance: 400, pose: quickFeet, rise: () => 6, extra: cones(160) }),
  drill({ key: "cone-ladder-feet", athlete: AWA, cycles: 12, distance: 480, pose: quickFeet, rise: () => 4, extra: cones(80) }),
  drill({ key: "cone-t-run", athlete: AWA, cycles: 6, distance: 1200, pace: [0.3, 0.9, 0.5, 0.8], extra: cones(300) }),
  drill({ key: "figure-eight-cones", athlete: AWA, cycles: 6, distance: 1000, pose: weaving, extra: cones(250) }),
  drill({ key: "zigzag-cuts", athlete: AWA, cycles: 6, distance: 1200, pace: [0.6, 0.8, 0.6, 0.8], pose: weaving, extra: cones(240) }),
];

// Réagir au plot annoncé : la position d'attente, puis le départ.
const readyStance: Pose = { ...POSES.stand, lean: 24, head: -6, armA: 20, elbowA: 60, armB: 10, elbowB: 60, legA: 40, kneeA: 56, legB: 30, kneeB: 50 };
const reactive = (() => {
  const run = (t: number) => stride(t * 5 * TAU, 0.8);
  return motion({
    key: "reactive-cone-call",
    athlete: AWA,
    frame: (t) => {
      const u = smooth(0.4, 0.55, t) * (1 - smooth(0.9, 1, t));
      const go = run(t);
      const pose = Object.fromEntries(Object.keys(go).map((k) => [k, mix(readyStance[k as keyof Pose], go[k as keyof Pose], u)])) as Pose;
      return { pose, root: { x: STAND_ROOT.x, y: STAND_ROOT.y + 22 * (1 - u) - 14 * u * Math.abs(Math.sin(t * 5 * TAU)) } };
    },
    gear: (_, __, t) => cones(260)(smooth(0.45, 1, t) * 520),
    face: (t) => (t > 0.4 ? "effort" : "neutral"),
    stills: [0.12, 0.38, 0.62, 0.86],
  });
})();

const forwardBack = (() => {
  // Vers l'avant, puis à reculons : le passage de l'un à l'autre se fait en douceur, à mi-boucle et en fin de boucle.
  const run = (t: number): Pose => {
    const ahead = stride(t * 6 * TAU, 0.6);
    const back = backpedal(t * 6 * TAU);
    const w = smooth(0.42, 0.55, t) * (1 - smooth(0.9, 1, t));
    return Object.fromEntries(Object.keys(ahead).map((k) => [k, mix(ahead[k as keyof Pose], back[k as keyof Pose], w)])) as Pose;
  };
  return motion({
    key: "forward-back-cones",
    athlete: AWA,
    frame: (t) => ({ pose: run(t), root: { x: STAND_ROOT.x, y: STAND_ROOT.y - 10 - 8 * Math.abs(Math.sin(t * 6 * TAU)) } }),
    gear: (_, __, t) => cones(320)(t < 0.5 ? t * 640 : (1 - t) * 640),
    face: () => "effort",
    stills: [0.1, 0.35, 0.6, 0.85],
  });
})();

// --- Escaliers : trois marches, de bas en haut, puis on recommence ------------------------------

const RISE = 30;
const RUN = 70;
const FIRST = MIDDLE - 40;
const flight = (count: number): GearShape => ({
  kind: "poly",
  points: [
    { x: FIRST, y: GYM.ground + 4 },
    ...Array.from({ length: count }, (_, i) => [
      { x: FIRST + i * RUN, y: GYM.ground - (i + 1) * RISE },
      { x: FIRST + (i + 1) * RUN, y: GYM.ground - (i + 1) * RISE },
    ]).flat(),
    { x: FIRST + count * RUN + 60, y: GYM.ground - count * RISE },
    { x: FIRST + count * RUN + 60, y: GYM.ground + 4 },
  ],
  paint: "step",
});
const STEPS = 4;
// L'appui sur la marche `n` (0 : le sol devant la première marche).
const onStep = (n: number, dx = 0) => ({ at: { x: FIRST - 30 + n * RUN + (n ? 64 : 0) + dx, y: GYM.ground - n * RISE - 16 } });
const climb = (lift: number): PosePatch => ({ lean: 10, ...arms(-20, 60), legA: 2, kneeA: 4, legB: lift, kneeB: lift + 20 });
const stairs = (draft: Omit<ExerciseDraft, "athlete" | "gear">): ExerciseClip => exercise({ athlete: AWA, gear: () => [flight(STEPS)], ...draft });

const stairClips: ExerciseClip[] = [
  stairs({
    key: "stair-walk",
    positions: [
      calm({ lean: 4 }, onStep(0)),
      calm({ lean: 12, ...arms(-20, 60), legA: 60, kneeA: 74, legB: -8, kneeB: 10 }, onStep(0, -6)),
      calm(climb(-10), onStep(1)),
      calm(climb(-10), { ...onStep(2), hold: 0.7 }),
    ],
  }),
  stairs({
    key: "single-leg-stair-hops",
    positions: [
      calm({ lean: 6, legB: -20, kneeB: 80 }, onStep(0)),
      effort({ lean: 14, ...arms(60, 40), legA: 40, kneeA: 50, legB: -20, kneeB: 80 }, onStep(1)),
      effort({ lean: 14, ...arms(-30, 40), legA: 30, kneeA: 40, legB: -20, kneeB: 80 }, onStep(2)),
      calm({ lean: 6, legB: -20, kneeB: 80 }, { ...onStep(3), hold: 0.7 }),
    ],
  }),
  stairs({
    key: "quick-stair-run",
    duration: 2800,
    positions: [
      calm({ lean: 10, ...arms(-20, 70) }, onStep(0)),
      effort({ lean: 16, ...arms(40, 80), legA: 4, kneeA: 6, legB: 50, kneeB: 80 }, onStep(1)),
      effort({ lean: 16, ...arms(-40, 80), legA: 4, kneeA: 6, legB: 50, kneeB: 80 }, onStep(2)),
      effort({ lean: 16, ...arms(40, 80), legA: 4, kneeA: 6, legB: 50, kneeB: 80 }, { ...onStep(3), hold: 0.7 }),
    ],
  }),
  stairs({
    key: "alternating-stair-bounds",
    positions: [
      calm({ lean: 8 }, onStep(0)),
      effort({ lean: 16, ...arms(-50, 60), legA: 70, kneeA: 70, legB: -20, kneeB: 10 }, { root: air(70, 30) }),
      effort({ lean: 14, ...arms(40, 60), legA: 30, kneeA: 40, legB: -10, kneeB: 30 }, onStep(2)),
      calm({ lean: 6 }, { ...onStep(4), hold: 0.7 }),
    ],
  }),
  stairs({
    key: "two-foot-stair-jumps",
    positions: [
      calm({ lean: 10, ...arms(-30, 20), ...legs(40, 56) }, onStep(0)),
      effort({ lean: 4, ...arms(150, 10), ...legs(40, 70) }, { root: air(90, 40) }),
      effort({ lean: 26, ...arms(60, 24), ...legs(60, 80) }, onStep(2)),
      calm({ lean: 6 }, { ...onStep(2), hold: 0.7 }),
    ],
  }),
  stairs({
    key: "stair-step-down",
    positions: [
      calm({ lean: 4, ...arms(30, 20) }, onStep(1)),
      calm({ lean: 10, ...arms(40, 20), legA: 4, kneeA: 6, legB: 30, kneeB: 10 }, onStep(1)),
      effort({ lean: 18, ...arms(50, 20), legA: 40, kneeA: 56, legB: -10, kneeB: 0 }, { ...onStep(1), on: "footA" }),
      calm({ lean: 6, ...arms(30, 20), legA: 10, kneeA: 10, legB: 30, kneeB: 40 }, onStep(1)),
    ],
  }),
  stairs({
    key: "stair-knee-balance",
    positions: [
      calm({ lean: 4 }, onStep(0)),
      calm({ lean: 12, ...arms(-20, 60), legA: 60, kneeA: 74, legB: -8, kneeB: 10 }, onStep(0, -6)),
      effort({ lean: 0, ...arms(-40, 80), armB: 40, legA: 2, kneeA: 2, legB: 92, kneeB: 96 }, onStep(1)),
      calm({ lean: 0, ...arms(-30, 80), armB: 30, legA: 2, kneeA: 2, legB: 92, kneeB: 96 }, { ...onStep(1), hold: 0.7 }),
    ],
  }),
];

// --- Échauffement --------------------------------------------------------------------------------

const warm = (draft: Omit<ExerciseDraft, "athlete">): ExerciseClip => exercise({ athlete: LILA, ...draft });
const WALL = MIDDLE - 110;
const wall: GearShape = { kind: "rect", x: WALL - 40, y: 60, width: 40, height: 344, paint: "step" };

// La corde vue de profil : elle tourne autour du corps, des mains vers un point qui passe au-dessus de la tête,
// devant, sous les pieds, puis derrière.
const ropeAt = (phase: number, hand: { x: number; y: number }, center: { x: number; y: number }): GearShape[] => {
  const far = { x: center.x + 80 * Math.sin(phase), y: center.y - 200 * Math.cos(phase) };
  const bow = (from: { x: number; y: number }, to: { x: number; y: number }, side: number): GearShape => ({
    kind: "curve",
    from,
    control: { x: (from.x + to.x) / 2 + side * 46, y: (from.y + to.y) / 2 },
    to,
    width: 4,
    paint: "band",
    front: Math.sin(phase) > 0,
  });
  return [bow(hand, far, 1), bow(hand, far, -1)];
};
const jumpRope = motion({
  key: "easy-jump-rope",
  athlete: LILA,
  duration: 3200,
  frame: (t) => {
    const phase = t * 8 * TAU;
    const hop = Math.max(0, Math.sin(phase));
    return {
      pose: { ...POSES.stand, lean: 0, head: -4, ...arms(16, 60), legA: 6, kneeA: 6 + 10 * (1 - hop), legB: 0, kneeB: 6 + 10 * (1 - hop) },
      root: { x: STAND_ROOT.x, y: STAND_ROOT.y - 24 * hop },
    };
  },
  gear: (frame, at, t) => ropeAt(t * 8 * TAU, at.handA, { x: frame.root.x, y: frame.root.y - 40 }),
  stills: [0.04, 0.3, 0.55, 0.8],
});

const armCircles = motion({
  key: "arm-circles",
  athlete: LILA,
  duration: 4000,
  frame: (t) => ({ pose: { ...POSES.stand, lean: 0, ...arms((t * 4 * 360) % 360, 0, 0), legB: -7 }, root: STAND_ROOT }),
  // Quatre tours par boucle : chaque image fixe montre le bras à un autre endroit du cercle.
  stills: [0.0125, 0.325, 0.6375, 0.95],
});

const legSwings = warm({
  key: "leg-swings",
  positions: [
    calm({ lean: -2, ...arms(-60, 20), armB: -60 }, { x: -20 }),
    calm({ lean: -6, ...arms(-60, 20), legA: 4, kneeA: 4, legB: 70, kneeB: 10 }, { x: -20 }),
    calm({ lean: 6, ...arms(-60, 20), legA: 4, kneeA: 4, legB: -40, kneeB: 16 }, { x: -20 }),
    calm({ lean: -4, ...arms(-60, 20), legA: 4, kneeA: 4, legB: 50, kneeB: 10 }, { x: -20 }),
  ],
  gear: () => [wall],
});

const kneeHug = warm({
  key: "walking-knee-hug",
  positions: [
    calm({ lean: 2, legA: 14, kneeA: 6, legB: -14, kneeB: 10 }),
    calm({ lean: 0, ...arms(40, 110), legA: 2, kneeA: 2, legB: 100, kneeB: 120 }, { on: "footA" }),
    calm({ lean: 0, ...arms(-10, 30), legA: -14, kneeA: 10, legB: 14, kneeB: 6 }, { on: "footB" }),
    calm({ lean: 0, ...arms(40, 110), legA: 100, kneeA: 120, legB: 2, kneeB: 2 }, { on: "footB" }),
  ],
});

const anklesWalk = drill({
  key: "ankle-walking-drill",
  athlete: LILA,
  cycles: 6,
  distance: 400,
  pose: (phase) => ({
    ...POSES.stand,
    lean: 0,
    legA: 6 + 16 * Math.sin(phase),
    kneeA: 4 + 8 * up(Math.sin(phase)),
    legB: 6 - 16 * Math.sin(phase),
    kneeB: 4 + 8 * up(-Math.sin(phase)),
    armA: -24 * Math.sin(phase),
    elbowA: 60,
    armB: 24 * Math.sin(phase),
    elbowB: 60,
  }),
  rise: (phase) => 6 + 4 * Math.abs(Math.cos(phase)),
  face: () => "neutral",
});

const scapular = (sink: number) =>
  settle((rot) => ({ rot, lean: -sink, head: -8, ...arms(rot - sink, 0, 0), ...legs(sink, 0, 0) }), [40, 100], "handA", "footA", -1);
const scapularPushUp = warm({
  key: "scapular-push-up",
  positions: [calm(scapular(0)), calm(scapular(5)), effort(scapular(-5)), calm(scapular(0))].map((p) => ({
    ...p,
    on: "handA" as const,
    at: { x: MIDDLE + 90, y: GYM.ground - 15 },
  })),
});

const warmupJog = drill({ key: "warmup-jog", athlete: LILA, cycles: 5, distance: 700, pace: [0.15, 0.25, 0.3, 0.2], face: () => "neutral" });

export const DRILLS: readonly ExerciseClip[] = [
  ...coordination,
  reactive,
  forwardBack,
  ...stairClips,
  jumpRope,
  armCircles,
  legSwings,
  kneeHug,
  anklesWalk,
  scapularPushUp,
  warmupJog,
];
