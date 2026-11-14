// Course et gammes : Inès, l'athlète des haies. Elle court au centre de la scène, la piste défile sous elle.
import { mix, runPose, runRise, smooth } from "../clip";
import { accumulate, cycleStills, GYM, motion, STAND_ROOT, track, type ExerciseClip, type GearShape } from "../exercise";
import { POSES } from "../poses";
import type { Face } from "../rig";
import type { Pose } from "../skeleton";

const ATHLETE = "hurdles" as const;
const TAU = Math.PI * 2;
const HIP = STAND_ROOT.y;
const lane = (offset: number): GearShape[] => [
  { kind: "line", from: { x: 0, y: GYM.ground + 14 }, to: { x: GYM.width, y: GYM.ground + 14 }, width: 5, cap: "butt", paint: "lane" },
  ...track(offset, 200),
];

// Une allure, de 0 (trottiner) à 1 (vitesse maximale) : l'amplitude, l'inclinaison et l'envol suivent.
const stride = (phase: number, pace: number): Pose => {
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

type Drill = {
  key: string;
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

const drill = ({ key, cycles, distance, duration = 4000, pace = [0.5, 0.5, 0.5, 0.5], pose = stride, rise, face, tilt }: Drill) => {
  const speed = paceAt(pace);
  const phaseAt = accumulate((t) => 0.6 + 0.6 * speed(t), cycles * TAU);
  const travel = accumulate((t) => 0.3 + speed(t), distance);
  return motion({
    key,
    athlete: ATHLETE,
    duration,
    frame: (t) => {
      const phase = phaseAt(t);
      const k = speed(t);
      const lift = rise ? rise(phase, k) : runRise(phase) * (0.6 + 0.5 * k);
      return { pose: pose(phase, k, t), root: { x: STAND_ROOT.x, y: HIP - lift } };
    },
    gear: (_, __, t) => lane(travel(t)),
    face: face ?? ((t) => (speed(t) > 0.7 ? "effort" : "neutral")),
    stills: cycleStills(cycles),
    tilt,
  });
};

const up = (value: number) => Math.max(0, value);

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

export const RUNNING: readonly ExerciseClip[] = [
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
