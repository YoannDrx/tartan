// Course et gammes : Inès, l'athlète des haies. Elle court au centre de la scène, la piste défile sous elle.
import { mix, runPose, runRise, smooth } from "../clip";
import { accumulate, cycleStills, exercise, GYM, MIDDLE, motion, STAND_ROOT, track, type ExerciseClip, type GearShape, type Position } from "../exercise";
import { POSES } from "../poses";
import type { Face } from "../rig";
import type { EventId } from "../event";
import type { Pose } from "../skeleton";

const ATHLETE = "hurdles" as const;
const TAU = Math.PI * 2;
const HIP = STAND_ROOT.y;
const lane = (offset: number): GearShape[] => [
  { kind: "line", from: { x: 0, y: GYM.ground + 14 }, to: { x: GYM.width, y: GYM.ground + 14 }, width: 5, cap: "butt", paint: "lane" },
  ...track(offset, 200),
];

// Une allure, de 0 (trottiner) à 1 (vitesse maximale) : l'amplitude, l'inclinaison et l'envol suivent.
export const stride = (phase: number, pace: number): Pose => {
  const run = runPose(phase);
  const k = 0.5 + 0.5 * pace;
  return {
    ...run,
    lean: 2 + 6 * pace,
    legA: 12 + (run.legA - 12) * k,
    legB: 12 + (run.legB - 12) * k,
    kneeA: 40 + (run.kneeA - 40) * k,
    kneeB: 40 + (run.kneeB - 40) * k,
    armA: run.armA * k,
    armB: run.armB * k,
  };
};

// Une allure par ligne du guide, avec un passage doux de l'une à l'autre.
const paceAt = (paces: readonly [number, number, number, number]) => (t: number) => {
  const i = Math.min(3, Math.floor(t * 4));
  const next = paces[(i + 1) % 4]!;
  return mix(paces[i]!, next, smooth(0.8, 1, t * 4 - i));
};

export type Drill = {
  key: string;
  athlete?: EventId;
  // Du matériel qui défile avec la piste (des plots), placé d'après le chemin parcouru.
  extra?: (travelled: number) => GearShape[];
  // Foulées complètes (deux appuis) par boucle, et chemin parcouru en une boucle.
  cycles: number;
  distance: number;
  duration?: number;
  pace?: readonly [number, number, number, number];
  pose?: (phase: number, pace: number, t: number) => Pose;
  rise?: (phase: number, pace: number) => number;
  face?: (t: number) => Face;
  tilt?: number;
};

export const drill = ({
  key,
  athlete = ATHLETE,
  extra,
  cycles,
  distance,
  duration = 4000,
  pace = [0.5, 0.5, 0.5, 0.5],
  pose = stride,
  rise,
  face,
  tilt,
}: Drill) => {
  const speed = paceAt(pace);
  const phaseAt = accumulate((t) => 0.6 + 0.6 * speed(t), cycles * TAU);
  const travel = accumulate((t) => 0.3 + speed(t), distance);
  return motion({
    key,
    athlete,
    duration,
    frame: (t) => {
      const phase = phaseAt(t);
      const k = speed(t);
      const lift = rise ? rise(phase, k) : runRise(phase) * (0.6 + 0.5 * k);
      return { pose: pose(phase, k, t), root: { x: STAND_ROOT.x, y: HIP - lift } };
    },
    gear: (_, __, t) => [...lane(travel(t)), ...(extra?.(travel(t)) ?? [])],
    face: face ?? ((t) => (speed(t) > 0.7 ? "effort" : "neutral")),
    stills: cycleStills(cycles),
    tilt,
  });
};

export const up = (value: number) => Math.max(0, value);

// Montées de genoux : la cuisse monte à l'horizontale, peu d'avancée.
const highKnees = drill({
  key: "high-knees",
  cycles: 6,
  distance: 600,
  pose: (phase) => ({
    ...POSES.stand,
    lean: -2,
    head: -4,
    legA: 6 + 84 * up(Math.sin(phase)),
    kneeA: 14 + 92 * up(Math.sin(phase)),
    legB: 6 + 84 * up(-Math.sin(phase)),
    kneeB: 14 + 92 * up(-Math.sin(phase)),
    armA: -50 * Math.sin(phase),
    elbowA: 84,
    armB: 50 * Math.sin(phase),
    elbowB: 84,
  }),
  rise: (phase) => 6 + 10 * Math.abs(Math.cos(phase)),
});

// Talons-fesses : la cuisse reste presque verticale, le talon remonte sous le bassin.
const buttKicks = drill({
  key: "butt-kicks",
  cycles: 6,
  distance: 600,
  pose: (phase) => ({
    ...POSES.stand,
    lean: 4,
    legA: 4 + 14 * up(Math.sin(phase)),
    kneeA: 12 + 132 * up(Math.sin(phase)),
    legB: 4 + 14 * up(-Math.sin(phase)),
    kneeB: 12 + 132 * up(-Math.sin(phase)),
    armA: -40 * Math.sin(phase),
    elbowA: 86,
    armB: 40 * Math.sin(phase),
    elbowB: 86,
  }),
  rise: (phase) => 4 + 10 * Math.abs(Math.cos(phase)),
});

// Skipping : montée de genou, rebond sur l'appui.
const aSkip = drill({
  key: "a-skip",
  cycles: 4,
  distance: 800,
  pose: (phase) => ({
    ...POSES.stand,
    lean: 0,
    head: -4,
    legA: 6 + 86 * up(Math.sin(phase)),
    kneeA: 10 + 96 * up(Math.sin(phase)),
    legB: 6 + 86 * up(-Math.sin(phase)),
    kneeB: 10 + 96 * up(-Math.sin(phase)),
    armA: -60 * Math.sin(phase),
    elbowA: 90,
    armB: 60 * Math.sin(phase),
    elbowB: 90,
  }),
  rise: (phase) => 8 + 22 * Math.abs(Math.sin(2 * phase)),
});

// Marche technique : sans phase de vol, la jambe d'appui reste tendue.
const aMarch = drill({
  key: "a-march",
  cycles: 3,
  distance: 480,
  duration: 4800,
  pose: (phase) => ({
    ...POSES.stand,
    lean: 0,
    head: -2,
    legA: 2 + 88 * up(Math.sin(phase)),
    kneeA: 4 + 96 * up(Math.sin(phase)),
    legB: 2 + 88 * up(-Math.sin(phase)),
    kneeB: 4 + 96 * up(-Math.sin(phase)),
    armA: -60 * Math.sin(phase),
    elbowA: 90,
    armB: 60 * Math.sin(phase),
    elbowB: 90,
  }),
  rise: () => 0,
  face: () => "neutral",
});

const straightLeg = drill({
  key: "straight-leg-run",
  cycles: 5,
  distance: 800,
  pose: (phase) => ({
    ...POSES.stand,
    lean: -2,
    legA: 8 + 46 * Math.sin(phase),
    kneeA: 6,
    legB: 8 - 46 * Math.sin(phase),
    kneeB: 6,
    armA: -50 * Math.sin(phase),
    elbowA: 84,
    armB: 50 * Math.sin(phase),
    elbowB: 84,
  }),
  rise: (phase) => 6 + 8 * Math.abs(Math.sin(phase)),
});

// Dribbles bas : de petits cercles rapides, la cheville passe au-dessus de l'autre.
const lowDribbles = drill({
  key: "low-dribbles",
  cycles: 8,
  distance: 480,
  pose: (phase) => ({
    ...POSES.stand,
    lean: 4,
    legA: 6 + 18 * up(Math.sin(phase)),
    kneeA: 10 + 62 * up(Math.sin(phase + 0.6)),
    legB: 6 + 18 * up(-Math.sin(phase)),
    kneeB: 10 + 62 * up(-Math.sin(phase + 0.6)),
    armA: -30 * Math.sin(phase),
    elbowA: 84,
    armB: 30 * Math.sin(phase),
    elbowB: 84,
  }),
  rise: (phase) => 2 + 4 * Math.abs(Math.cos(phase)),
});

// Le départ debout : un pied devant, le corps incliné, puis les premières foulées qui se redressent.
const startPose: Pose = { ...POSES.stand, lean: 30, head: 6, armA: -40, elbowA: 80, armB: 50, elbowB: 80, legA: 28, kneeA: 34, legB: -24, kneeB: 20 };
const sprintStart = (() => {
  const speed = paceAt([0, 0.7, 0.95, 0.9]);
  const phaseAt = accumulate((t) => (t < 0.22 ? 0 : 0.6 + 0.6 * speed(t)), 5 * TAU);
  const travel = accumulate((t) => (t < 0.22 ? 0 : 0.3 + speed(t)), 1000);
  return motion({
    key: "standing-sprint-start",
    athlete: ATHLETE,
    duration: 4400,
    frame: (t) => {
      const phase = phaseAt(t);
      const k = speed(t);
      // La pente du buste diminue à mesure que la vitesse s'installe.
      const lean = mix(34, 8, smooth(0.25, 0.9, t));
      const run = { ...stride(phase, k), lean };
      const u = smooth(0.18, 0.3, t) * (1 - smooth(0.96, 1, t));
      const pose = Object.fromEntries(
        Object.keys(run).map((key) => [key, mix(startPose[key as keyof Pose], run[key as keyof Pose], u)]),
      ) as Pose;
      return { pose, root: { x: STAND_ROOT.x, y: HIP + 14 * (1 - u) - runRise(phase) * u } };
    },
    gear: (_, __, t) => lane(travel(t)),
    face: (t) => (t > 0.2 ? "effort" : "neutral"),
    stills: [0.1, 0.36, 0.6, 0.85],
  });
})();

// --- Version 5 du catalogue -----------------------------------------------------------------------

// Skipping B : le genou monte, puis la jambe se déplie vers l'avant avant de griffer le sol sous le bassin.
const bSkip = drill({
  key: "b-skip",
  cycles: 4,
  distance: 800,
  pose: (phase) => {
    const lift = up(Math.sin(phase));
    const reach = up(Math.sin(phase - 0.9));
    const liftB = up(-Math.sin(phase));
    const reachB = up(-Math.sin(phase - 0.9));
    return {
      ...POSES.stand,
      lean: 0,
      head: -4,
      legA: 6 + 84 * lift,
      kneeA: 10 + 100 * lift * (1 - reach),
      legB: 6 + 84 * liftB,
      kneeB: 10 + 100 * liftB * (1 - reachB),
      armA: -60 * Math.sin(phase),
      elbowA: 90,
      armB: 60 * Math.sin(phase),
      elbowB: 90,
    };
  },
  rise: (phase) => 8 + 20 * Math.abs(Math.sin(2 * phase)),
});

const calm = (pose: Partial<Pose>, extra: Omit<Position, "pose"> = {}): Position => ({ pose, ...extra });
const effort = (pose: Partial<Pose>, extra: Omit<Position, "pose"> = {}): Position => ({ pose, face: "effort", ...extra });
const WALL = MIDDLE + 120;
const wall: GearShape = { kind: "rect", x: WALL, y: 40, width: 40, height: 364, paint: "step" };
// Contre le mur : le corps incliné en appui sur les mains, une jambe puis l'autre.
const leaning = (front: "A" | "B"): Partial<Pose> => ({
  rot: 34,
  lean: 0,
  head: -6,
  armA: 56,
  elbowA: 0,
  armB: 52,
  elbowB: 0,
  legA: front === "A" ? 92 : 4,
  kneeA: front === "A" ? 100 : 4,
  legB: front === "B" ? 92 : 4,
  kneeB: front === "B" ? 100 : 4,
});
const wallDrive = exercise({
  key: "wall-drive",
  athlete: ATHLETE,
  positions: [
    calm({ rot: 34, lean: 0, head: -6, armA: 56, elbowA: 0, armB: 52, elbowB: 0, legA: 4, kneeA: 4, legB: 0, kneeB: 4 }, { on: "footB", x: -40 }),
    effort(leaning("A"), { on: "footB", x: -40 }),
    effort(leaning("B"), { on: "footA", x: -40 }),
    calm(leaning("A"), { on: "footB", x: -40 }),
  ],
  gear: () => [wall],
});

// Le départ accroupi : une main au sol derrière la ligne, puis la poussée et le redressement.
const crouchPose: Pose = { ...POSES.stand, lean: 64, head: 0, armA: 66, elbowA: 0, armB: -40, elbowB: 40, legA: 74, kneeA: 96, legB: 20, kneeB: 110 };
const crouchStart = (() => {
  const speed = paceAt([0, 0.75, 0.95, 0.9]);
  const phaseAt = accumulate((t) => (t < 0.24 ? 0 : 0.6 + 0.6 * speed(t)), 5 * TAU);
  const travel = accumulate((t) => (t < 0.24 ? 0 : 0.3 + speed(t)), 1000);
  return motion({
    key: "crouch-start",
    athlete: ATHLETE,
    duration: 4400,
    frame: (t) => {
      const phase = phaseAt(t);
      const run = { ...stride(phase, speed(t)), lean: mix(40, 8, smooth(0.25, 0.9, t)) };
      const u = smooth(0.2, 0.32, t) * (1 - smooth(0.96, 1, t));
      const pose = Object.fromEntries(Object.keys(run).map((k) => [k, mix(crouchPose[k as keyof Pose], run[k as keyof Pose], u)])) as Pose;
      return { pose, root: { x: STAND_ROOT.x, y: HIP + 46 * (1 - u) - runRise(phase) * u } };
    },
    gear: (_, __, t) => lane(travel(t)),
    face: (t) => (t > 0.2 ? "effort" : "neutral"),
    stills: [0.1, 0.36, 0.6, 0.85],
  });
})();

// Les haies basses : on les enjambe en marchant, jambe d'attaque puis jambe d'esquive.
const hurdleAt = (x: number, height = 76): GearShape[] => [
  { kind: "line", from: { x, y: GYM.ground }, to: { x, y: GYM.ground - height }, width: 6, paint: "hurdle" },
  { kind: "line", from: { x: x - 4, y: GYM.ground - height }, to: { x: x + 34, y: GYM.ground - height }, width: 10, paint: "hurdle" },
];
const overHurdle = (key: string, lead: Partial<Pose>, trail: Partial<Pose>) =>
  exercise({
    key,
    athlete: ATHLETE,
    positions: [
      calm({ lean: 2, armA: -20, elbowA: 60, armB: 20, elbowB: 60 }, { x: -70 }),
      calm({ lean: 4, armA: -40, elbowA: 70, armB: 30, elbowB: 70, ...lead }, { on: "footB", x: -70 }),
      calm({ lean: 6, armA: 30, elbowA: 70, armB: -30, elbowB: 70, ...trail }, { on: "footA", x: 30 }),
      calm({ lean: 2, armA: 10, elbowA: 60, armB: -10, elbowB: 60, legA: 10, kneeA: 6, legB: -12, kneeB: 10 }, { x: 30, hold: 0.7 }),
    ],
    gear: () => hurdleAt(MIDDLE - 30),
  });
const hurdleWalkover = overHurdle("hurdle-walkover", { legA: 96, kneeA: 100, legB: -6, kneeB: 4 }, { legA: 4, kneeA: 4, legB: 80, kneeB: 110 });
const hurdleLead = overHurdle("hurdle-lead-leg", { legA: 88, kneeA: 14, legB: -6, kneeB: 4 }, { legA: 6, kneeA: 6, legB: 40, kneeB: 90 });
const hurdleTrail = overHurdle("hurdle-trail-leg", { legA: 20, kneeA: 10, legB: 60, kneeB: 120 }, { legA: 4, kneeA: 4, legB: 92, kneeB: 120 });

export const RUNNING: readonly ExerciseClip[] = [
  bSkip,
  wallDrive,
  crouchStart,
  hurdleWalkover,
  hurdleLead,
  hurdleTrail,
  highKnees,
  buttKicks,
  drill({ key: "progressive-acceleration", cycles: 6, distance: 1400, pace: [0.2, 0.6, 0.95, 0.3] }),
  drill({ key: "flying-sprint", cycles: 6, distance: 1600, pace: [0.5, 0.8, 1, 0.3] }),
  sprintStart,
  drill({ key: "short-hill-sprint", cycles: 6, distance: 1000, pace: [0.5, 0.85, 0.9, 0.2], tilt: -10 }),
  drill({ key: "easy-continuous-run", cycles: 5, distance: 800, pace: [0.25, 0.3, 0.3, 0.25] }),
  drill({ key: "short-running-intervals", cycles: 6, distance: 1200, pace: [0.3, 0.85, 0.2, 0.85] }),
  drill({ key: "long-running-intervals", cycles: 6, distance: 1200, pace: [0.3, 0.7, 0.7, 0.25] }),
  drill({ key: "fartlek", cycles: 6, distance: 1200, pace: [0.3, 0.3, 0.85, 0.35] }),
  drill({ key: "track-tempo", cycles: 6, distance: 1200, pace: [0.5, 0.65, 0.65, 0.4] }),
  aSkip,
  straightLeg,
  aMarch,
  lowDribbles,
];
