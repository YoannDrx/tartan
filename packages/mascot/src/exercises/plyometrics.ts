// Pliométrie : Noé, l'athlète de la hauteur. Les bonds qui avancent gardent l'athlète au centre : le sol défile.
import { mix, runPose, runRise } from "../clip";
import {
  air,
  box,
  exercise,
  GYM,
  marks,
  medicineBall,
  MIDDLE,
  motion,
  STAND_ROOT,
  cycleStills,
  type ExerciseClip,
  type ExerciseDraft,
  type GearShape,
  type Position,
} from "../exercise";
import { HIGH_JUMP_CLIP } from "../high-jump-event";
import { HIGH_JUMP_PHASES } from "../high-jump";
import { POSES } from "../poses";
import { jointPositions, type Point, type Pose } from "../skeleton";
import { arms, legs, type PosePatch } from "./base";

const ATHLETE = "highJump" as const;
const jump = (draft: Omit<ExerciseDraft, "athlete">): ExerciseClip => exercise({ athlete: ATHLETE, duration: 3600, ...draft });
const effort = (pose: PosePatch, extra: Omit<Position, "pose"> = {}): Position => ({ pose, face: "effort", ...extra });
const calm = (pose: PosePatch, extra: Omit<Position, "pose"> = {}): Position => ({ pose, ...extra });

const stand: PosePatch = { lean: 2, ...arms(8, 16) };
const loaded: PosePatch = { lean: 34, head: 4, ...arms(-48, 14), ...legs(72, 100) };
const squatHold: PosePatch = { lean: 30, ...arms(40, 30), ...legs(82, 106) };
const extended: PosePatch = { lean: -2, head: -8, ...arms(168, 6), ...legs(-4, 4) };
const tucked: PosePatch = { lean: 6, ...arms(120, 30), ...legs(70, 96) };
const landed: PosePatch = { lean: 26, head: 4, ...arms(58, 24), ...legs(58, 78) };

// --- Sauts verticaux ----------------------------------------------------------------------------

const squatJump = jump({
  key: "squat-jump",
  positions: [calm(stand), calm(squatHold), effort(extended, { root: air(90) }), calm(landed)],
});

const countermovement = jump({
  key: "countermovement-jump",
  positions: [
    calm({ ...stand, ...arms(150, 10) }),
    effort(loaded),
    effort(extended, { root: air(110), via: [{ pose: tucked, root: air(120) }] }),
    calm(landed),
  ],
});

const repeatedJumps = jump({
  key: "repeated-vertical-jumps",
  positions: [
    calm(stand),
    effort(extended, { root: air(70) }),
    effort({ lean: 14, ...arms(-30, 20), ...legs(32, 42) }),
    effort(extended, { root: air(70) }),
  ],
});

const pogo = jump({
  key: "pogo-jumps",
  duration: 2400,
  positions: [
    calm({ ...stand, ...legs(4, 8) }),
    effort({ lean: 0, ...arms(20, 30), ...legs(0, 2) }, { root: air(26) }),
    effort({ lean: 2, ...arms(10, 30), ...legs(8, 14) }),
    calm({ ...stand, ...legs(10, 16) }),
  ],
});

const lungeFront: PosePatch = { lean: 4, ...arms(-30, 30), legA: 84, kneeA: 92, legB: -8, kneeB: 92 };
const lungeBack: PosePatch = { lean: 4, ...arms(30, 30), legA: -8, kneeA: 92, legB: 84, kneeB: 92 };
const splitJumps = jump({
  key: "split-jumps",
  positions: [
    calm(lungeFront),
    effort({ lean: 0, ...arms(60, 20), legA: 30, kneeA: 30, legB: 10, kneeB: 40 }, { root: air(80) }),
    effort(lungeBack, { on: "footB" }),
    effort({ lean: 0, ...arms(-20, 20), legA: 10, kneeA: 40, legB: 30, kneeB: 30 }, { root: air(80) }),
  ],
});

// --- Sauts depuis une boîte ---------------------------------------------------------------------

const DROP = { from: MIDDLE - 230, width: 130, height: 60 };
const onDrop = { x: -165, at: { x: MIDDLE - 165, y: GYM.ground - DROP.height - 16 } };
const stepOff: PosePatch = { lean: 4, ...arms(30, 20), legA: 40, kneeA: 20, legB: -6, kneeB: 10 };
const dropJump = jump({
  key: "drop-jump",
  positions: [
    calm(stand, onDrop),
    calm(stepOff, { root: air(30, -80) }),
    effort({ ...landed, ...arms(-40, 20) }, { via: [{ pose: extended, root: air(100, 20), face: "effort" }] }),
    calm(landed, { via: [{ pose: { lean: 10, ...arms(10, 20), legA: 70, kneeA: 90, legB: 0, kneeB: 10 }, root: air(40, -90) }] }),
  ],
  gear: () => box(DROP.from, DROP.width, DROP.height),
});

const dropLanding = jump({
  key: "drop-landing",
  positions: [
    calm(stand, onDrop),
    calm(stepOff, { root: air(30, -80) }),
    effort({ lean: 32, head: 6, ...arms(70, 20), ...legs(72, 96) }),
    calm({ lean: 32, head: 6, ...arms(70, 20), ...legs(72, 96) }, {
      hold: 0.6,
      via: [{ pose: { lean: 10, ...arms(10, 20), legA: 70, kneeA: 90, legB: 0, kneeB: 10 }, root: air(40, -90) }],
    }),
  ],
  gear: () => box(DROP.from, DROP.width, DROP.height),
});

const BOX = { from: MIDDLE + 70, width: 150, height: 70 };
const boxJump = jump({
  key: "box-jump",
  positions: [
    calm(stand, { x: -60 }),
    effort(loaded, { x: -60, via: [{ pose: { lean: 8, head: -6, ...arms(150, 10), ...legs(100, 130) }, root: { x: MIDDLE + 40, y: 150 } }] }),
    effort({ lean: 28, head: 6, ...arms(60, 20), ...legs(80, 104) }, { at: { x: MIDDLE + 120, y: GYM.ground - BOX.height - 16 } }),
    calm(stand, {
      at: { x: MIDDLE + 120, y: GYM.ground - BOX.height - 16 },
      face: "joy",
      via: [{ pose: { lean: 6, ...legs(20, 10), legB: -20, kneeB: 30 }, root: { x: MIDDLE + 10, y: 250 } }],
    }),
  ],
  gear: () => box(BOX.from, BOX.width, BOX.height),
});

// Un saut qui avance : la réception est loin devant, le retour au départ est bref.
const broadJump = jump({
  key: "standing-broad-jump",
  positions: [
    calm({ ...stand, ...arms(150, 10) }, { x: -100 }),
    effort(loaded, { x: -100 }),
    effort({ lean: 10, ...arms(120, 20), ...legs(60, 80) }, { root: air(70, -10), via: [{ pose: { lean: 0, ...arms(90, 20), ...legs(96, 110) }, root: air(40, 60) }] }),
    calm(landed, { x: 120, hold: 0.8 }),
  ],
  gear: () => [
    { kind: "rect", x: MIDDLE - 130, y: GYM.ground + 2, width: 6, height: 10, paint: "lane" },
    { kind: "rect", x: MIDDLE + 150, y: GYM.ground + 2, width: 6, height: 10, paint: "lane" },
  ],
});

// --- Lancers de médecine-ball -------------------------------------------------------------------

// Le ballon suit la main jusqu'au lâcher, puis vole en cloche et sort du cadre.
const thrown = (clip: ExerciseClip, release: number, velocity: Point): ExerciseClip => {
  const { pose, root } = clip.frame(release);
  const start = jointPositions(pose, root).handA;
  const gear = (t: number): GearShape[] => {
    const base = clip.gear(t);
    if (t < release) return base;
    const s = (t - release) * 2.4;
    return [...base, ...medicineBall({ x: start.x + velocity.x * s, y: start.y + velocity.y * s + 900 * s * s })];
  };
  return { ...clip, gear };
};
const holding = (clip: ExerciseClip, until: number): ExerciseClip => ({
  ...clip,
  gear: (t) => {
    const base = clip.gear(t);
    if (t >= until) return base;
    const { pose, root } = clip.frame(t);
    return [...base, ...medicineBall(jointPositions(pose, root).handA)];
  },
});

const chest = arms(36, 140, 2);
const forwardThrow = thrown(
  holding(
    jump({
      key: "medicine-ball-forward",
      positions: [
        calm({ lean: 2, ...chest }),
        calm({ lean: 14, ...chest, ...legs(30, 40), legB: -12 }),
        effort({ lean: 20, ...arms(84, 0, 2), legA: 20, kneeA: 10, legB: -20, kneeB: 10 }),
        calm({ lean: 8, ...arms(60, 10, 2), legA: 14, kneeA: 6, legB: -18, kneeB: 10 }),
      ],
    }),
    0.55,
  ),
  0.55,
  { x: 700, y: -320 },
);

const backwardThrow = thrown(
  holding(
    jump({
      key: "medicine-ball-backward",
      positions: [
        calm({ lean: 4, ...arms(20, 10, 2) }),
        effort({ lean: 44, head: -10, ...arms(44, 0, 2), ...legs(70, 96) }),
        effort({ lean: -18, head: -20, ...arms(200, 0, 2), ...legs(-6, 4) }),
        calm({ lean: 4, ...arms(40, 20, 2), ...legs(14, 12) }),
      ],
    }),
    0.55,
  ),
  0.55,
  { x: -520, y: -700 },
);

const rotationThrow = thrown(
  holding(
    jump({
      key: "medicine-ball-rotation",
      positions: [
        calm({ lean: 2, ...arms(30, 60, 2), ...legs(14, 10), legB: -14 }),
        effort({ lean: -6, ...arms(-40, 50, 2), ...legs(20, 20), legB: -16 }),
        effort({ lean: 14, ...arms(96, 10, 2), legA: 24, kneeA: 14, legB: -24, kneeB: 20 }),
        calm({ lean: 8, ...arms(70, 20, 2), legA: 18, kneeA: 10, legB: -20, kneeB: 16 }),
      ],
    }),
    0.55,
  ),
  0.55,
  { x: 720, y: -200 },
);

// --- Bonds et élans : l'athlète court au centre, le sol défile -----------------------------------

const HIP = STAND_ROOT.y;
const TAU = Math.PI * 2;
// La foulée bondissante : la course, en plus ample et plus haute.
const bound = (stride: number): Pose => {
  const run = runPose(stride);
  const swing = Math.sin(stride);
  return { ...run, lean: 8, legA: 20 + 62 * swing, legB: 20 - 62 * swing, armA: -70 * swing, armB: 70 * swing };
};
const alternatingBounds = motion({
  key: "alternating-bounds",
  athlete: ATHLETE,
  duration: 4000,
  frame: (t) => {
    const stride = t * 4 * TAU;
    return { pose: bound(stride), root: { x: MIDDLE, y: HIP - 18 - 56 * Math.abs(Math.sin(stride)) } };
  },
  face: () => "effort",
  gear: (_, __, t) => marks(t, 1600),
  stills: cycleStills(4),
});

const curvedApproach = motion({
  key: "curved-approach",
  athlete: ATHLETE,
  duration: 4000,
  frame: (t) => {
    const stride = t * 6 * TAU;
    // Dans la courbe, le corps entier penche ; en sortie il se redresse et ralentit.
    const tilt = t < 0.25 ? 0 : t < 0.75 ? 8 : mix(8, 0, (t - 0.75) * 4);
    return { pose: { ...runPose(stride), rot: tilt }, root: { x: MIDDLE, y: HIP - runRise(stride) } };
  },
  gear: (_, __, t) => [
    ...marks(t, 1440, 240, "cone").map((shape) =>
      shape.kind === "rect"
        ? ({ kind: "poly", points: [{ x: shape.x, y: GYM.ground + 4 }, { x: shape.x + 13, y: GYM.ground - 26 }, { x: shape.x + 26, y: GYM.ground + 4 }], paint: "cone", scroll: true } as GearShape)
        : shape,
    ),
  ],
  stills: cycleStills(6),
});

const threeStep = jump({
  key: "three-step-takeoff",
  positions: [
    calm(stand, { x: -160 }),
    effort({ ...runPose(Math.PI / 2), lean: 6 }, { root: air(18, -90), via: [{ pose: { ...runPose(Math.PI * 1.5), lean: 6 }, root: air(18, -30) }] }),
    effort({ lean: -6, head: -10, ...arms(150, 20), legA: 92, kneeA: 100, legB: -12, kneeB: 4 }, { x: 20 }),
    calm(landed, { x: 140, hold: 0.7, via: [] }),
  ].map((p, i) => (i === 2 ? { ...p, via: [{ pose: { lean: -4, ...arms(160, 20), legA: 80, kneeA: 110, legB: 10, kneeB: 60 }, root: air(110, 80) }] } : p)),
});

// Les sauts par-dessus des haies basses qui défilent : une haie passe sous l'athlète à chaque sommet.
const HOP_SPACING = 220;
const hurdle = (x: number): GearShape[] => [
  { kind: "line", from: { x, y: GYM.ground }, to: { x, y: GYM.ground - 70 }, width: 6, paint: "hurdle", scroll: true },
  { kind: "line", from: { x: x - 4, y: GYM.ground - 70 }, to: { x: x + 30, y: GYM.ground - 70 }, width: 10, paint: "hurdle", scroll: true },
];
const hops = (key: string, count: number, oneLeg: boolean, withHurdles: boolean) =>
  motion({
    key,
    athlete: ATHLETE,
    duration: 1100 * count,
    frame: (t) => {
      const phase = (t * count) % 1;
      // Un contact court, puis le vol : le bassin décrit une cloche.
      const contact = phase < 0.22;
      const u = contact ? 0 : (phase - 0.22) / 0.78;
      const height = contact ? 0 : (withHurdles ? 96 : 46) * Math.sin(Math.PI * u);
      const fold = contact ? 1 - Math.abs(phase / 0.11 - 1) : 0;
      const tuck = Math.sin(Math.PI * u);
      const pose: Pose = {
        ...POSES.stand,
        lean: 10 + 16 * fold,
        head: -4,
        ...arms(30 - 60 * fold + 60 * tuck, 30),
        legA: 8 + 50 * fold + (withHurdles ? 60 : 20) * tuck,
        kneeA: 10 + 60 * fold + (withHurdles ? 80 : 30) * tuck,
        legB: oneLeg ? -10 + 30 * tuck : 4 + 50 * fold + (withHurdles ? 60 : 20) * tuck,
        kneeB: oneLeg ? 90 : 10 + 60 * fold + (withHurdles ? 80 : 30) * tuck,
      };
      return { pose, root: { x: MIDDLE, y: HIP + 10 * fold - height } };
    },
    face: () => "effort",
    gear: (_, __, t) => {
      const shift = (t * count * HOP_SPACING) % HOP_SPACING;
      const first = MIDDLE - 0.61 * HOP_SPACING - shift + HOP_SPACING;
      return withHurdles
        ? [-1, 0, 1, 2].flatMap((i) => hurdle(first + i * HOP_SPACING - 15))
        : marks(t, count * HOP_SPACING, HOP_SPACING);
    },
    stills: cycleStills(count),
  });

// Le saut à la barre complet est le geste de Noé sur sa scène : élan, appel, franchissement, réception.
const { approach, takeoff, landing } = HIGH_JUMP_PHASES;
const highJump = (key: string): ExerciseClip =>
  motion({
    key,
    athlete: ATHLETE,
    stage: HIGH_JUMP_CLIP.stage,
    duration: HIGH_JUMP_CLIP.duration,
    frame: HIGH_JUMP_CLIP.frame,
    gear: (_, __, t) => HIGH_JUMP_CLIP.props(t),
    face: HIGH_JUMP_CLIP.face,
    cuts: [approach[0], takeoff[0], landing[0]],
    stills: [approach[0] / 2, (approach[0] + takeoff[0]) / 2, mix(takeoff[0], landing[0], 0.55), (landing[0] + 1) / 2],
    loop: false,
    floor: false,
    view: `200 0 ${1200} ${800}`,
  });

export const PLYOMETRICS: readonly ExerciseClip[] = [
  alternatingBounds,
  curvedApproach,
  threeStep,
  highJump("high-jump-full"),
  highJump("high-jump-short"),
  hops("low-hurdle-hops", 3, false, true),
  hops("single-leg-hops", 4, true, false),
  dropJump,
  repeatedJumps,
  splitJumps,
  forwardThrow,
  squatJump,
  countermovement,
  broadJump,
  boxJump,
  pogo,
  dropLanding,
  backwardThrow,
  rotationThrow,
];
