// Mobilité : Lila, l'athlète de la longueur. Les rotations qui se lisent de dessus ou de face (90/90, livre ouvert,
// cosaque, rotation de hanche sur le ventre) attendent un autre point de vue.
import { above, exercise, ground, MIDDLE, motion, STAND_ROOT, type ExerciseClip, type ExerciseDraft, type GearShape, type Position } from "../exercise";
import { POSES } from "../poses";
import { arms, hanging, settle, type PosePatch } from "./base";

const LILA = "longJump" as const;
const stretch = (draft: Omit<ExerciseDraft, "athlete">): ExerciseClip => exercise({ athlete: LILA, duration: 5200, ...draft });
const calm = (pose: PosePatch, extra: Omit<Position, "pose"> = {}): Position => ({ pose, ...extra });
const WALL_X = MIDDLE + 120;
const wall: GearShape = { kind: "rect", x: WALL_X, y: 60, width: 40, height: 344, paint: "step" };

// À quatre pattes : les mains sous les épaules, les tibias au sol ; `rot` recule ou avance le bassin.
const quadruped = (rot: number, patch: PosePatch = {}) =>
  settle((knee) => ({ rot, lean: 0, head: -14, ...arms(rot, 0, 0), legA: rot, kneeA: knee, legB: rot - 2, kneeB: knee, ...patch }), [40, 170], "handA", "footA", -1);
const onHands = { on: "handA" as const, at: ground("handA", 90) };
const QUAD = 84;

const catCow = stretch({
  key: "cat-cow",
  positions: [
    calm(quadruped(QUAD), onHands),
    calm(quadruped(QUAD, { lean: -8, head: -40 }), onHands),
    calm(quadruped(QUAD, { lean: 8, head: 24 }), onHands),
    calm(quadruped(QUAD), onHands),
  ],
});

const wristRocks = stretch({
  key: "wrist-rocks",
  positions: [
    calm(quadruped(QUAD), onHands),
    calm(quadruped(QUAD + 8, { armA: QUAD + 22, armB: QUAD + 22 }), onHands),
    calm(quadruped(QUAD + 8, { armA: QUAD + 22, armB: QUAD + 22 }), onHands),
    calm(quadruped(QUAD - 10, { armA: QUAD - 20, armB: QUAD - 20 }), onHands),
  ],
});

const adductorRock = stretch({
  key: "adductor-rockback",
  positions: [
    calm(quadruped(QUAD), onHands),
    calm(quadruped(64, { armA: 96, armB: 96 }), onHands),
    calm(quadruped(50, { armA: 108, armB: 108 }), onHands),
    calm(quadruped(QUAD), onHands),
  ],
});

const thoracic = stretch({
  key: "quadruped-thoracic-rotation",
  positions: [
    calm(quadruped(QUAD, { armA: 150, elbowA: 150 }), { on: "handB", at: ground("handB", 90) }),
    calm(quadruped(QUAD, { armA: 40, elbowA: 140, head: 0 }), { on: "handB", at: ground("handB", 90) }),
    calm(quadruped(QUAD, { armA: 230, elbowA: 140, head: -40 }), { on: "handB", at: ground("handB", 90) }),
    calm(quadruped(QUAD, { armA: 150, elbowA: 150 }), { on: "handB", at: ground("handB", 90) }),
  ],
});

// À genoux, assise sur les talons, bras allongés devant.
const childPose = (reach: number) =>
  settle((rot) => ({ rot, lean: 0, head: 10, ...arms(rot + 70 * reach, 0, 0), legA: rot + 80, kneeA: 170, legB: rot + 78, kneeB: 170 }), [40, 120], "footA", "handA", -1);
const childReach = stretch({
  key: "child-pose-reach",
  positions: [calm(childPose(0.6), { x: -60 }), calm(childPose(1), { x: -60 }), calm(childPose(1), { x: -60 }), calm(childPose(0.6), { x: -60 })],
});

const kneel = (rot: number, leg: number, knee: number, patch: PosePatch = {}) => ({ rot, lean: 0, head: 0, ...arms(20, 10), legA: leg, kneeA: knee, legB: leg - 2, kneeB: knee, ...patch });
const toeRock = stretch({
  key: "toe-extension-rock",
  positions: [
    calm(kneel(10, 10, 96, { lean: 10, ...arms(60, 10) }), { x: -40 }),
    calm(kneel(0, 60, 150, { lean: 10 }), { x: -40 }),
    calm(kneel(0, 80, 170, { lean: 6 }), { x: -40 }),
    calm(kneel(6, 20, 100, { lean: 6 }), { x: -40 }),
  ],
});

// En fente, genou arrière posé : jambe avant fléchie, tibia arrière au sol.
const halfKneel = (front: number, patch: PosePatch = {}) =>
  settle((kneeB) => ({ lean: 0, ...arms(10, 10), legA: front, kneeA: front + 6, legB: -20, kneeB, ...patch }), [40, 150], "footA", "footB", 0);
const hipFlexor = stretch({
  key: "half-kneeling-hip-flexor",
  positions: [
    calm(halfKneel(84)),
    calm(halfKneel(84, { lean: -4 })),
    calm(halfKneel(96, { lean: -2, legB: -34 })),
    calm(halfKneel(96, { lean: -6, legB: -34, ...arms(176, 0), armA: 20 })),
  ],
});

const greatest = (arm: number) =>
  settle((kneeB) => ({ lean: 56, head: -10, ...hanging(56), armB: arm, legA: 104, kneeA: 120, legB: -22, kneeB }), [40, 150], "footA", "footB", 0);
const worldsGreatest = stretch({
  key: "worlds-greatest-stretch",
  positions: [calm(greatest(56)), calm(greatest(56)), calm(greatest(-120)), calm(greatest(56))],
});

// Allongée sur le dos, tête à gauche, une jambe monte tendue.
const onBack = { on: "shoulder" as const, at: above("shoulder", 14, -40) };
const supine = (leg: number): PosePatch => ({ rot: -90, lean: 0, head: 0, ...arms(-6, 0, 0), legA: leg, kneeA: 2, legB: 0, kneeB: 2 });
const legRaise = stretch({
  key: "active-straight-leg-raise",
  positions: [calm(supine(0), onBack), calm(supine(40), onBack), calm(supine(72), onBack), calm(supine(20), onBack)],
});

const sweep = (lean: number) => ({ lean, head: -lean / 4, ...hanging(lean), armA: lean + 20, legA: 30, kneeA: 2, legB: -8, kneeB: 18 });
const hamstringSweep = stretch({
  key: "hamstring-sweep",
  positions: [calm(sweep(2), { on: "footB" }), calm(sweep(30), { on: "footB" }), calm(sweep(58), { on: "footB" }), calm(sweep(10), { on: "footB" })],
});

const kneeUp = (leg: number, knee: number) => ({ lean: 0, ...arms(-50, 10), armB: 70, legA: leg, kneeA: knee, legB: 2, kneeB: 2 });
const hipCar = stretch({
  key: "hip-car",
  positions: [
    calm(kneeUp(20, 60), { on: "footB" }),
    calm(kneeUp(90, 100), { on: "footB" }),
    calm(kneeUp(40, 110), { on: "footB" }),
    calm(kneeUp(-30, 100), { on: "footB" }),
  ],
  gear: () => [wall],
});

const shoulderCar = motion({
  key: "shoulder-car",
  athlete: LILA,
  duration: 6000,
  frame: (t) => ({ pose: { ...POSES.stand, lean: 0, armA: (t * 360) % 360, elbowA: 0, armB: -10, elbowB: 16 }, root: STAND_ROOT }),
  stills: [0.04, 0.3, 0.55, 0.8],
});

const stick = (_: unknown, at: { handA: { x: number; y: number } }): GearShape[] => [
  { kind: "disc", x: at.handA.x, y: at.handA.y, radius: 9, paint: "iron", front: true },
];
const shoulderStick = stretch({
  key: "shoulder-stick",
  positions: [calm({ lean: 0, ...arms(10, 0, 2) }), calm({ lean: 0, ...arms(90, 0, 2) }), calm({ lean: 0, ...arms(180, 0, 2) }), calm({ lean: 2, ...arms(250, 0, 2) })],
  gear: stick,
});

const wallSlide = stretch({
  key: "wall-slide",
  positions: [
    calm({ lean: 4, ...arms(90, 90, 2) }, { x: 40 }),
    calm({ lean: 4, ...arms(130, 50, 2) }, { x: 40 }),
    calm({ lean: 4, ...arms(160, 20, 2) }, { x: 40 }),
    calm({ lean: 4, ...arms(110, 70, 2) }, { x: 40 }),
  ],
  gear: () => [wall],
});

const ankleWall = stretch({
  key: "ankle-knee-wall",
  positions: [
    calm({ lean: 4, ...arms(80, 30, 2), legA: 10, kneeA: 10, legB: -20, kneeB: 10 }, { x: 40 }),
    calm({ lean: 4, ...arms(84, 20, 2), legA: 40, kneeA: 70, legB: -18, kneeB: 20 }, { x: 40 }),
    calm({ lean: 4, ...arms(84, 20, 2), legA: 48, kneeA: 86, legB: -18, kneeB: 24 }, { x: 40 }),
    calm({ lean: 4, ...arms(80, 30, 2), legA: 20, kneeA: 30, legB: -20, kneeB: 14 }, { x: 40 }),
  ],
  gear: () => [wall],
});

const quadMobility = stretch({
  key: "standing-quadriceps-mobility",
  positions: [
    calm({ lean: 0, ...arms(60, 10), armB: 0 }, { on: "footA" }),
    calm({ lean: 2, ...arms(60, 10), armB: -40, elbowB: 30, legB: -6, kneeB: 120 }, { on: "footA" }),
    calm({ lean: 0, ...arms(60, 10), armB: -36, elbowB: 34, legB: -14, kneeB: 140 }, { on: "footA" }),
    calm({ lean: 0, ...arms(60, 10), armB: 0, legB: -4, kneeB: 40 }, { on: "footA" }),
  ],
});

export const MOBILITY: readonly ExerciseClip[] = [
  ankleWall,
  catCow,
  shoulderStick,
  hipFlexor,
  adductorRock,
  worldsGreatest,
  legRaise,
  hamstringSweep,
  hipCar,
  shoulderCar,
  wallSlide,
  thoracic,
  childReach,
  wristRocks,
  toeRock,
  quadMobility,
];
