// Musculation : un athlète du groupe (Mehdi, l'athlète de la rubrique Exercices), de profil, tourné vers la droite.
// Les exercices qui se lisent de face (élévations latérales, fente latérale) attendent un autre point de vue.
import { POSES } from "../poses";
import { jointPositions, type Point } from "../skeleton";
import {
  above,
  barbell,
  bench,
  box,
  dumbbell,
  exercise,
  GEAR,
  ground,
  kettlebell,
  MIDDLE,
  type ExerciseClip,
  type ExerciseDraft,
  type GearShape,
  type Position,
} from "../exercise";
import { arms, backRack, frontRack, hanging, legs, overhead, settle, type PosePatch } from "./base";

const ATHLETE = "discus" as const;
const lift = (draft: Omit<ExerciseDraft, "athlete">): ExerciseClip => exercise({ athlete: ATHLETE, ...draft });
const effort = (pose: PosePatch, extra: Omit<Position, "pose"> = {}): Position => ({ pose, face: "effort", ...extra });
const calm = (pose: PosePatch, extra: Omit<Position, "pose"> = {}): Position => ({ pose, ...extra });

// Un montant de rack derrière la barre, et sa sécurité à hauteur de hanche basse.
const rack = (safety = 300): GearShape[] => [
  { kind: "rect", x: MIDDLE + 104, y: 150, width: 12, height: 254, radius: 3, paint: "iron" },
  { kind: "rect", x: MIDDLE + 80, y: safety, width: 48, height: 8, radius: 3, paint: "iron" },
];
const bar = (_: unknown, at: Record<"handA" | "head", Point>) => barbell(at.handA, at.head);
const bells = (_: unknown, at: Record<"handA", Point>) => dumbbell(at.handA);

// Les pieds à plat, la barre posée au sol : le buste se règle pour que le disque touche le sol.
const floorPull = (leg: number, knee: number, head = -14) =>
  settle(
    (lean) => ({ lean, head, ...hanging(lean), ...legs(leg, knee) }),
    [0, 85],
    "footA",
    "handA",
    -(GEAR.plate - 16),
  );

// --- Squats -------------------------------------------------------------------------------------

const backSquat = lift({
  key: "back-squat",
  positions: [
    calm({ lean: 4, ...backRack }),
    calm({ lean: 8, head: 4, ...backRack, ...legs(10, 8) }),
    effort({ lean: 32, head: 10, ...backRack, ...legs(90, 118) }),
    effort({ lean: 24, head: 6, ...backRack, ...legs(52, 72) }),
  ],
  gear: (_, at) => [...rack(), ...barbell(at.handA, at.head)],
});

const frontSquat = lift({
  key: "front-squat",
  positions: [
    calm({ lean: 2, ...frontRack }),
    calm({ lean: 4, ...frontRack, ...legs(8, 6) }),
    effort({ lean: 16, head: 4, ...frontRack, ...legs(100, 132) }),
    effort({ lean: 12, ...frontRack, ...legs(55, 76) }),
  ],
  gear: (_, at) => [...rack(), ...barbell(at.handA, at.head)],
});

const gobletHold = arms(28, 150, 2);
const gobletSquat = lift({
  key: "goblet-squat",
  positions: [
    calm({ lean: 2, ...gobletHold }),
    calm({ lean: 6, ...gobletHold, ...legs(14, 12) }),
    effort({ lean: 20, head: 6, ...gobletHold, ...legs(100, 130) }),
    effort({ lean: 12, ...gobletHold, ...legs(50, 70) }),
  ],
  gear: (_, at) => kettlebell(at.handA),
});

const reach = arms(82, 4);
const boxBottom: PosePatch = { lean: 26, ...reach, ...legs(90, 100) };
const BOX_SEAT = (() => {
  const at = jointPositions({ ...POSES.stand, ...boxBottom });
  return { x: at.pelvis.x - at.footA.x, top: at.footA.y + 16 - at.pelvis.y - 24 };
})();
const boxSquat = lift({
  key: "box-squat",
  positions: [
    calm({ lean: 2, ...arms(20, 10) }),
    calm({ lean: 30, ...reach, ...legs(45, 58) }),
    effort(boxBottom),
    calm({ lean: 4, ...arms(20, 10) }),
  ],
  gear: () => bench(MIDDLE + BOX_SEAT.x - 60, MIDDLE + BOX_SEAT.x + 24, BOX_SEAT.top),
});

// --- Fentes -------------------------------------------------------------------------------------

const splitStand: PosePatch = { legA: 18, kneeA: 0, legB: -22, kneeB: 10 };
const splitLow: PosePatch = { legA: 84, kneeA: 92, legB: -8, kneeB: 92 };
const splitSquat = lift({
  key: "split-squat",
  positions: [
    calm({ lean: 2, ...splitStand }),
    effort({ lean: 3, legA: 52, kneeA: 50, legB: -16, kneeB: 52 }),
    effort({ lean: 4, ...splitLow }),
    calm({ lean: 2, ...splitStand }),
  ],
});

const BULGARIAN_TOP = 70;
const bulgarian = (leg: number, knee: number) =>
  settle(
    (kneeB) => ({ lean: 10, ...arms(10, 10), legA: leg, kneeA: knee, legB: -34, kneeB }),
    [40, 150],
    "footA",
    "footB",
    -BULGARIAN_TOP,
  );
const bulgarianStand = bulgarian(14, 2);
const bulgarianBench = (() => {
  const foot = jointPositions({ ...POSES.stand, ...bulgarianStand }).footB.x - jointPositions({ ...POSES.stand, ...bulgarianStand }).footA.x;
  return bench(MIDDLE + foot - 50, MIDDLE + foot + 30, BULGARIAN_TOP);
})();
const bulgarianSquat = lift({
  key: "bulgarian-squat",
  positions: [calm(bulgarianStand), calm(bulgarian(24, 14)), effort(bulgarian(84, 94)), effort(bulgarian(46, 50))],
  gear: () => bulgarianBench,
});

// La jambe avant a fait son pas : l'appui fixe passe sur son pied, plus loin devant.
const forwardLunge = lift({
  key: "forward-lunge",
  positions: [
    calm({ lean: 2, ...arms(10, 20) }),
    calm({ lean: 2, ...arms(-10, 20), legA: 42, kneeA: 8, legB: -20, kneeB: 14 }, { x: 70 }),
    effort({ lean: 4, ...arms(-6, 20), ...splitLow }, { x: 70 }),
    calm({ lean: 6, ...arms(16, 20), legA: 40, kneeA: 40, legB: -14, kneeB: 30 }, { x: 70 }),
  ],
});

const reverseLunge = lift({
  key: "reverse-lunge",
  positions: [
    calm({ lean: 2, ...hanging(2) }),
    calm({ lean: 3, ...hanging(3), legA: 14, kneeA: 6, legB: -30, kneeB: 20 }),
    effort({ lean: 4, ...hanging(4), ...splitLow }),
    calm({ lean: 3, ...hanging(3), legA: 40, kneeA: 40, legB: -10, kneeB: 50 }),
  ],
  gear: bells,
});

const STEP = { from: MIDDLE + 30, width: 150, height: 66 };
const stepUp = lift({
  key: "step-up",
  positions: [
    calm({ lean: 2, ...hanging(2) }, { on: "footB" }),
    calm({ lean: 14, ...hanging(14), legA: 76, kneeA: 92, legB: -4, kneeB: 6 }, { on: "footB" }),
    effort({ lean: 4, ...hanging(4), legA: 4, kneeA: 2, legB: 30, kneeB: 70 }, { at: above("footA", STEP.height, 70) }),
    calm({ lean: 10, ...hanging(10), legA: 30, kneeA: 50, legB: -16, kneeB: 6 }, { at: above("footA", STEP.height, 70) }),
  ],
  gear: (_, at) => [...box(STEP.from, STEP.width, STEP.height), ...dumbbell(at.handA)],
});

// --- Charnière de hanche ------------------------------------------------------------------------

const deadlift = lift({
  key: "deadlift",
  positions: [
    calm(floorPull(84, 108)),
    effort(floorPull(78, 98), { via: [{ pose: { lean: 36, head: -6, ...hanging(36), ...legs(36, 38) }, face: "effort" }] }),
    calm({ lean: 0, ...hanging(0), ...legs(4, 2) }),
    calm({ lean: 42, head: -10, ...hanging(42), ...legs(30, 26) }),
  ],
  gear: bar,
});

const romanian = lift({
  key: "romanian-deadlift",
  positions: [
    calm({ lean: 0, ...hanging(0), ...legs(10, 12) }),
    calm({ lean: 40, head: -8, ...hanging(40), ...legs(22, 22) }),
    effort({ lean: 68, head: -14, ...hanging(68), ...legs(26, 26) }),
    calm({ lean: 24, head: -4, ...hanging(24), ...legs(16, 16) }),
  ],
  gear: bar,
});

const singleLeg = (lean: number, back: number) => ({
  lean,
  head: -lean / 5,
  ...hanging(lean),
  armB: lean + 30,
  legA: 14,
  kneeA: 14,
  legB: back,
  kneeB: 12,
});
const singleLegRdl = lift({
  key: "single-leg-rdl",
  positions: [
    calm(singleLeg(4, -8)),
    calm(singleLeg(40, -42)),
    effort(singleLeg(76, -80)),
    calm(singleLeg(30, -30)),
  ],
  gear: bells,
});

const sumoDeadlift = lift({
  key: "sumo-deadlift",
  positions: [
    calm(floorPull(70, 112, -10)),
    effort(floorPull(68, 106, -10), { via: [{ pose: { lean: 20, ...hanging(20), ...legs(34, 40) }, face: "effort" }] }),
    calm({ lean: 0, ...hanging(0), ...legs(6, 2) }),
    calm({ lean: 24, ...hanging(24), ...legs(40, 50) }),
  ],
  gear: bar,
});

const goodMorning = lift({
  key: "good-morning",
  positions: [
    calm({ lean: 2, ...backRack, ...legs(8, 10) }),
    calm({ lean: 24, ...backRack, ...legs(14, 16) }),
    effort({ lean: 62, head: -10, ...backRack, ...legs(20, 20) }),
    calm({ lean: 30, ...backRack, ...legs(16, 18) }),
  ],
  gear: (_, at) => [...rack(), ...barbell(at.handA, at.head)],
});

// --- Au sol et sur le banc : allongé sur le dos, tête à gauche ----------------------------------

// Pieds au sol et épaules posées : l'inclinaison du corps se règle pour que les épaules touchent le sol.
// Les bras s'allongent au sol, vers les pieds.
const bridge = (leg: number, knee: number, other?: PosePatch) =>
  settle(
    (rot) => ({ rot, lean: 0, head: -4, ...arms(rot + 92, 0, 0), legA: leg, kneeA: knee, legB: leg - 4, kneeB: knee, ...other }),
    [-130, -30],
    "footA",
    "shoulder",
    -(44 - 16),
  );
const glutes = lift({
  key: "glute-bridge",
  positions: [calm(bridge(52, 124)), calm(bridge(46, 118)), effort(bridge(0, 96)), calm(bridge(30, 112))].map((p) => ({
    ...p,
    x: 60,
  })),
});
const knee = (leg: number) => ({ legB: leg, kneeB: 120 });
const singleBridge = lift({
  key: "single-leg-bridge",
  positions: [
    calm(bridge(52, 124, knee(120))),
    calm(bridge(46, 118, knee(118))),
    effort(bridge(0, 96, knee(90))),
    calm(bridge(30, 112, knee(110))),
  ].map((p) => ({ ...p, x: 60 })),
});

// Les omoplates sur le bord du banc, la barre sur les hanches : le genou se règle pour garder les épaules sur le banc.
const THRUST_TOP = 46;
const thrust = (rot: number, leg: number) =>
  settle(
    (knee) => ({ rot, lean: 0, head: -6, ...arms(30, 10, 0), legA: leg, kneeA: knee, legB: leg - 3, kneeB: knee }),
    [30, 170],
    "footA",
    "shoulder",
    -(THRUST_TOP + 18 - 16),
  );
const thrustTop = thrust(-90, 0);
const THRUST_SHOULDER = (() => {
  const at = jointPositions({ ...POSES.stand, ...thrustTop });
  return at.shoulder.x - at.footA.x;
})();
const facing = (rot: number, from: Point, distance: number): Point => ({
  x: from.x + distance * Math.cos((rot * Math.PI) / 180),
  y: from.y + distance * Math.sin((rot * Math.PI) / 180),
});
const hipThrust = lift({
  key: "hip-thrust",
  positions: [calm(thrust(-58, 40)), calm(thrust(-62, 34)), effort(thrustTop), calm(thrust(-72, 22))].map((p) => ({
    ...p,
    x: 70,
  })),
  gear: (frame, at) => [
    ...bench(MIDDLE + 70 + THRUST_SHOULDER - 90, MIDDLE + 70 + THRUST_SHOULDER + 6, THRUST_TOP),
    ...barbell(facing(frame.pose.rot, at.pelvis, 44)),
  ],
});

// Couché sur le banc : le bassin sur le plateau, les pieds au sol.
const BENCH_TOP = GEAR.bench;
const lying = (arm: PosePatch, rot = -90) =>
  settle((knee) => ({ rot, lean: 0, head: 0, ...arm, legA: 8, kneeA: knee, legB: 4, kneeB: knee }), [40, 140], "pelvis", "footA", BENCH_TOP + 24 - 16);
const pressUp = arms(90, 0, 2);
const pressDown = arms(-53, 143, 2);
const pressMid = arms(20, 80, 2);
const onBench = { on: "pelvis" as const, at: above("pelvis", BENCH_TOP - 4, 0) };
const benchUnder = bench(MIDDLE - 150, MIDDLE + 40);
const benchPress = lift({
  key: "bench-press",
  positions: [
    calm(lying(pressUp), onBench),
    calm(lying(pressUp), onBench),
    effort(lying(pressDown), onBench),
    effort(lying(pressMid), onBench),
  ],
  gear: (_, at) => [...benchUnder, ...barbell(at.handA, at.head)],
});
const dumbbellBench = lift({
  key: "dumbbell-bench-press",
  positions: [
    calm(lying(pressMid), onBench),
    calm(lying(pressUp), onBench),
    effort(lying(pressDown), onBench),
    effort(lying(pressMid), onBench),
  ],
  gear: (_, at) => [...benchUnder, ...dumbbell(at.handA)],
});
// Le dossier incliné : le bassin sur l'assise, le buste relevé et appuyé sur un plateau dans son dos.
const GYM_GROUND = 400;
const backrest = (rot: number, pelvis: Point): GearShape => {
  const up = { x: Math.sin((rot * Math.PI) / 180), y: -Math.cos((rot * Math.PI) / 180) };
  const front = { x: Math.cos((rot * Math.PI) / 180), y: Math.sin((rot * Math.PI) / 180) };
  const at = (along: number, across: number) => ({
    x: pelvis.x + up.x * along + front.x * across,
    y: pelvis.y + up.y * along + front.y * across,
  });
  return { kind: "poly", points: [at(-6, -40), at(150, -40), at(150, -54), at(-6, -54)], paint: "bench" };
};
const incline = (arm: PosePatch) =>
  settle((knee) => ({ rot: -58, lean: 0, head: -6, ...arm, legA: 40, kneeA: knee, legB: 36, kneeB: knee }), [20, 140], "pelvis", "footA", BENCH_TOP + 24 - 16);
const inclineUp = arms(122, 0, 2);
const inclineDown = arms(-20, 140, 2);
const inclinePress = lift({
  key: "incline-dumbbell-press",
  positions: [
    calm(incline(arms(60, 110, 2)), onBench),
    calm(incline(inclineUp), onBench),
    effort(incline(inclineDown), onBench),
    effort(incline(arms(60, 90, 2)), onBench),
  ],
  gear: (_, at) => [
    ...bench(MIDDLE - 40, MIDDLE + 50),
    backrest(-58, { x: MIDDLE, y: GYM_GROUND - BENCH_TOP - 20 }),
    ...dumbbell(at.handA),
  ],
});

// --- Développés debout et assis -----------------------------------------------------------------

const overheadPress = lift({
  key: "overhead-press",
  positions: [
    calm({ lean: 0, ...frontRack }),
    calm({ lean: -2, ...frontRack, head: -4 }),
    effort({ lean: -4, ...arms(110, 60, 2), head: -10 }, { via: [] }),
    effort({ lean: 0, ...overhead(0) }),
  ],
  gear: (_, at) => [...rack(), ...barbell(at.handA, at.head)],
});

// Assis sur le banc : le genou se règle pour poser le pied à plat.
const SEAT_DROP = BENCH_TOP - 4 + 24 - 16;
const sitting = (patch: PosePatch, leg = 88) =>
  settle((knee) => ({ ...patch, legA: leg, kneeA: knee, legB: leg - 4, kneeB: knee }), [0, 160], "pelvis", "footA", SEAT_DROP);
const seated = (arm: PosePatch, lean = 0) => sitting({ lean, ...arm });
const onSeat = { on: "pelvis" as const, at: above("pelvis", BENCH_TOP - 4, -60) };
const seatedPress = lift({
  key: "seated-dumbbell-press",
  positions: [
    calm(seated(arms(40, 140, 2)), onSeat),
    calm(seated(arms(60, 150, 2)), onSeat),
    effort(seated(overhead(0)), onSeat),
    calm(seated(arms(110, 70, 2)), onSeat),
  ],
  gear: (_, at) => [...bench(MIDDLE - 110, MIDDLE - 10), ...dumbbell(at.handA)],
});

const pushPlank = (elbow: number, top = 0) =>
  settle(
    (rot) => ({ rot, lean: 0, head: -8, ...arms(rot - elbow, elbow, 0), ...legs(0, 0, 0) }),
    [30, 100],
    "handA",
    "footA",
    top - 1,
  );
const pushUp = lift({
  key: "push-up",
  positions: [calm(pushPlank(0)), effort(pushPlank(110)), effort(pushPlank(60)), calm(pushPlank(0))].map((p) => ({
    ...p,
    on: "handA" as const,
    at: ground("handA", 90),
  })),
});
const INCLINE_TOP = GEAR.bench;
const inclinePushUp = lift({
  key: "incline-push-up",
  positions: [
    calm(pushPlank(0, INCLINE_TOP)),
    effort(pushPlank(110, INCLINE_TOP)),
    effort(pushPlank(60, INCLINE_TOP)),
    calm(pushPlank(0, INCLINE_TOP)),
  ].map((p) => ({ ...p, on: "handA" as const, at: above("handA", INCLINE_TOP, 110) })),
  gear: () => bench(MIDDLE + 70, MIDDLE + 170),
});

// --- Tirages ------------------------------------------------------------------------------------

const BAR_HEIGHT = 372;
const pullBar = (): GearShape[] => [
  { kind: "rect", x: MIDDLE + 60, y: 40, width: 12, height: 364, radius: 3, paint: "iron" },
  { kind: "line", from: { x: MIDDLE + 66, y: 400 - BAR_HEIGHT - 17 }, to: { x: MIDDLE + 6, y: 400 - BAR_HEIGHT - 17 }, width: 8, paint: "iron" },
  { kind: "disc", x: MIDDLE + 6, y: 400 - BAR_HEIGHT - 17, radius: 7, paint: "iron", front: true },
];
const hang = { on: "handA" as const, at: { x: MIDDLE + 6, y: 400 - BAR_HEIGHT - 2 } };
const pullUp = (key: string, grip: number) =>
  lift({
    key,
    positions: [
      calm({ lean: 0, ...arms(176, 0, 2), ...legs(10, 30) }, hang),
      calm({ lean: -4, ...arms(170 - grip, 20, 2), ...legs(14, 34) }, hang),
      effort({ lean: -8, head: -12, ...arms(20 - grip, 150, 2), ...legs(20, 40) }, hang),
      calm({ lean: -4, ...arms(110, 70, 2), ...legs(14, 34) }, hang),
    ],
    gear: pullBar,
  });

// Couché sous une barre basse, les talons au sol : le corps reste droit et monte vers la barre.
const ROW_BAR = 170;
const underBar = (elbow: number) =>
  settle(
    (rot) => ({ rot, lean: 0, head: -4, ...arms(rot + 180 - elbow / 2, elbow, 0), ...legs(0, 0, 0) }),
    [-110, -40],
    "handA",
    "footA",
    ROW_BAR,
  );
const rowAt = { on: "handA" as const, at: above("handA", ROW_BAR, -20) };
const invertedRow = lift({
  key: "inverted-row",
  positions: [calm(underBar(0), rowAt), calm(underBar(10), rowAt), effort(underBar(120), rowAt), calm(underBar(50), rowAt)],
  gear: (_, at) => [
    { kind: "rect", x: MIDDLE - 40, y: 400 - ROW_BAR - 20, width: 10, height: ROW_BAR + 24, radius: 3, paint: "iron" },
    ...barbell(at.handA, at.head),
  ],
});

const bentOver = (lean: number, pull: number) => ({
  lean,
  head: -12,
  ...arms(lean - 50 * pull, 70 * pull, 2),
  ...legs(26, 28),
});
const barbellRow = lift({
  key: "barbell-row",
  positions: [calm(bentOver(64, 0)), calm(bentOver(66, 0.2)), effort(bentOver(66, 1)), calm(bentOver(66, 0.5))],
  gear: bar,
});

const oneArm = (pull: number) => ({ ...bentOver(78, pull), armB: 70, elbowB: 0, legA: 30, kneeA: 30, legB: 60, kneeB: 90 });
const oneArmRow = lift({
  key: "one-arm-row",
  positions: [calm(oneArm(0)), calm(oneArm(0.15)), effort(oneArm(1)), calm(oneArm(0.4))],
  gear: (_, at) => [...bench(at.handB.x - 70, at.handB.x + 30, Math.max(30, 400 - at.handB.y - 15)), ...dumbbell(at.handA)],
});

// La poulie haute : le câble monte de la barre vers le haut de la machine.
const PULLEY = { x: MIDDLE + 40, y: 40 };
const cable = (from: Point, to: Point): GearShape[] => [
  { kind: "line", from, to, width: 3, paint: "iron" },
  { kind: "disc", x: to.x, y: to.y, radius: 9, paint: "iron" },
];
const latSeat = { on: "pelvis" as const, at: above("pelvis", BENCH_TOP - 4, -30) };
const latPulldown = lift({
  key: "lat-pulldown",
  positions: [
    calm(sitting({ lean: -6, ...arms(168, 0, 2) }), latSeat),
    calm(sitting({ lean: -10, ...arms(160, 20, 2) }), latSeat),
    effort(sitting({ lean: -14, head: -6, ...arms(30, 150, 2) }), latSeat),
    calm(sitting({ lean: -10, ...arms(110, 70, 2) }), latSeat),
  ],
  gear: (_, at) => [...bench(MIDDLE - 80, MIDDLE + 20), ...cable(at.handA, PULLEY), ...barbell(at.handA, at.head).slice(1)],
});

const ANCHOR_LOW = { x: MIDDLE + 230, y: 330 };
const rowSeat = { on: "pelvis" as const, at: above("pelvis", BENCH_TOP - 4, -40) };
const seatedRow = (lean: number, pull: number) => sitting({ lean, ...arms(90 + lean - 40 * pull, 110 * pull, 2) }, 74);
const cableRow = lift({
  key: "seated-cable-row",
  positions: [calm(seatedRow(10, 0), rowSeat), calm(seatedRow(0, 0.1), rowSeat), effort(seatedRow(-6, 1), rowSeat), calm(seatedRow(4, 0.4), rowSeat)],
  gear: (_, at) => [...bench(MIDDLE - 90, MIDDLE + 10), ...cable(at.handA, ANCHOR_LOW), ...dumbbell(at.handA)],
});

const ANCHOR_HIGH = { x: MIDDLE + 230, y: 150 };
const facePull = lift({
  key: "face-pull",
  positions: [
    calm({ lean: -4, ...arms(100, 0, 2), ...legs(14, 6), legB: -14 }),
    calm({ lean: -6, ...arms(104, 20, 2), ...legs(14, 6), legB: -14 }),
    effort({ lean: -8, ...arms(96, 150, 2), ...legs(14, 6), legB: -14 }),
    calm({ lean: -6, ...arms(100, 70, 2), ...legs(14, 6), legB: -14 }),
  ],
  gear: (_, at) => [{ kind: "line", from: at.handA, to: ANCHOR_HIGH, width: 5, paint: "band" }],
});

const curl = (elbow: number) => ({ lean: 0, ...arms(4, elbow, 2) });
const bicepsCurl = lift({
  key: "biceps-curl",
  positions: [calm(curl(4)), calm(curl(50)), effort(curl(140)), calm(curl(60))],
  gear: bells,
});

const PUSHDOWN_PULLEY = { x: MIDDLE + 70, y: 60 };
const pushdown = (elbow: number) => ({ lean: 10, ...arms(10, elbow, 2), ...legs(10, 8) });
const tricepsPushdown = lift({
  key: "triceps-pushdown",
  positions: [calm(pushdown(100)), calm(pushdown(90)), effort(pushdown(6)), calm(pushdown(70))],
  gear: (_, at) => cable(at.handA, PUSHDOWN_PULLEY),
});

// La marche du fermier, sur place : une jambe puis l'autre, les haltères tenus bras tendus.
const walk = (phase: number): PosePatch => ({
  lean: 2,
  ...hanging(2),
  legA: 20 * phase,
  kneeA: phase > 0 ? 8 : 30,
  legB: -20 * phase,
  kneeB: phase > 0 ? 30 : 8,
});
const farmerCarry = lift({
  key: "farmer-carry",
  positions: [
    calm({ lean: 30, head: -10, ...hanging(30), ...legs(70, 96) }),
    calm({ lean: 0, ...hanging(0) }),
    effort(walk(1)),
    effort(walk(-1)),
  ],
  gear: bells,
});

// --- Mollets et pointes de pied -----------------------------------------------------------------

// Le squelette n'a pas de cheville articulée : sur l'avant-pied, le corps entier monte d'un cran.
const RISE = 10;
const calfRaise = lift({
  key: "standing-calf-raise",
  positions: [
    calm({ lean: 0, ...arms(10, 10) }),
    effort({ lean: 0, ...arms(10, 10) }, { at: above("footA", RISE) }),
    effort({ lean: 0, ...arms(14, 10) }, { at: above("footA", RISE) }),
    calm({ lean: 0, ...arms(10, 10) }),
  ],
});
const seatedCalf = lift({
  key: "seated-calf-raise",
  positions: [
    calm(seated(arms(48, 20, 2), 18), onSeat),
    effort(sitting({ lean: 18, ...arms(52, 24, 2) }, 94), onSeat),
    effort(sitting({ lean: 18, ...arms(52, 24, 2) }, 94), onSeat),
    calm(seated(arms(48, 20, 2), 18), onSeat),
  ],
  gear: (_, at) => [...bench(MIDDLE - 110, MIDDLE - 10), ...dumbbell(at.handA)],
});
const WALL = MIDDLE - 70;
const tibialis = lift({
  key: "tibialis-raise",
  positions: [
    calm({ rot: -10, lean: 0, ...arms(4, 4), ...legs(10, 0) }),
    effort({ rot: -12, lean: 0, ...arms(4, 4), ...legs(12, 0) }),
    effort({ rot: -12, lean: 0, ...arms(4, 4), ...legs(12, 0) }),
    calm({ rot: -10, lean: 0, ...arms(4, 4), ...legs(10, 0) }),
  ].map((p) => ({ ...p, x: 40 })),
  gear: () => [{ kind: "rect", x: WALL - 40, y: 60, width: 40, height: 344, paint: "step" }],
});

export const STRENGTH: readonly ExerciseClip[] = [
  backSquat,
  frontSquat,
  gobletSquat,
  boxSquat,
  splitSquat,
  bulgarianSquat,
  forwardLunge,
  reverseLunge,
  stepUp,
  deadlift,
  romanian,
  singleLegRdl,
  sumoDeadlift,
  hipThrust,
  glutes,
  singleBridge,
  goodMorning,
  calfRaise,
  seatedCalf,
  tibialis,
  benchPress,
  dumbbellBench,
  inclinePress,
  overheadPress,
  seatedPress,
  pushUp,
  inclinePushUp,
  pullUp("pull-up", 0),
  pullUp("chin-up", 10),
  invertedRow,
  barbellRow,
  oneArmRow,
  latPulldown,
  cableRow,
  facePull,
  bicepsCurl,
  tricepsPushdown,
  farmerCarry,
];
