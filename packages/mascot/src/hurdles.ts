// Les haies : la foulée ne s'arrête pas, elle s'allonge par-dessus l'obstacle.
import { blend, clamp, mix, runRise, samplePose, smooth, type Frame, type Key } from "./clip";
import { cruise, faceBy, hipOn, laneLine, runFrame, STEP, timeWhen, type EventClip, type Phase } from "./event";
import { POSES } from "./poses";
import type { PropShape } from "./props";
import { jointPositions, type Pose } from "./skeleton";

const STAGE = { width: 1400, height: 800, ground: 740 };
const HIP = hipOn(STAGE.ground);
const START = 130;
const END = 1290;

// Le franchissement, autour de chaque haie : de l'attaque à la reprise d'appui.
const BEFORE = 168;
const AFTER = 112;
// Chaque franchissement s'ouvre sur le même appui : la jambe d'attaque part devant, l'autre pousse.
export const HURDLES = [START + STEP * 2.5 + BEFORE, START + STEP * 6.5 + BEFORE] as const;
export const HURDLE_TOP = STAGE.ground - 118;
const LIFT = 82;

const AT = { run: 0.08, stop: 0.86, stand: 0.91, cheer: 0.96 };

const x = (t: number) => mix(START, END, cruise((t - AT.run) / (AT.stop - AT.run), 0.16, 0.14));
const run = (at: number) => runFrame(at, START, HIP);

// Les clés du franchissement, de 0 à 1 sur sa longueur. Les bords reprennent la foulée telle qu'elle est.
const clearance = (hurdle: number): Key<Pose>[] => {
  const from = hurdle - BEFORE;
  const span = BEFORE + AFTER;
  const stride = (u: number): Key<Pose> => ({ t: u, v: run(from + u * span).pose });
  const key = (u: number, patch: Partial<Pose>): Key<Pose> => ({ t: u, v: { ...POSES.stand, ...patch } });
  return [
    stride(-0.08),
    stride(0),
    // Attaque : le genou monte droit vers la haie, la jambe se déplie déjà, le bras opposé part devant.
    key(0.2, {
      rot: 12,
      lean: 12,
      head: -6,
      armA: -44,
      elbowA: 74,
      armB: 90,
      elbowB: 22,
      legA: 102,
      kneeA: 42,
      legB: -46,
      kneeB: 6,
    }),
    // Au-dessus : la jambe d'attaque tendue, le buste couché dessus, la jambe d'esquive repliée.
    key(0.46, {
      rot: 12,
      lean: 28,
      head: -18,
      armA: -62,
      elbowA: 84,
      armB: 104,
      elbowB: 8,
      legA: 98,
      kneeA: 4,
      legB: -24,
      kneeB: 118,
    }),
    // Reprise : la jambe d'attaque redescend vite, le genou d'esquive passe devant.
    key(0.76, {
      rot: 9,
      lean: 12,
      head: -8,
      armA: 26,
      elbowA: 80,
      armB: 4,
      elbowB: 82,
      legA: 34,
      kneeA: 6,
      legB: 74,
      kneeB: 112,
    }),
    stride(1),
    stride(1.08),
  ];
};
const CLEARANCES = HURDLES.map((hurdle) => ({ hurdle, keys: clearance(hurdle) }));

const moving = (at: number): Frame => {
  const base = run(at);
  for (const { hurdle, keys } of CLEARANCES) {
    const u = (at - (hurdle - BEFORE)) / (BEFORE + AFTER);
    if (u <= 0 || u >= 1) continue;
    // Aux bords, la foulée et le franchissement se confondent : le fondu ne se voit pas.
    const inside = smooth(0, 0.14, u) * (1 - smooth(0.86, 1, u));
    const stride = ((at - START) / STEP) * Math.PI;
    return {
      pose: { ...samplePose(keys, u), sx: 1, sy: 1 },
      root: { x: at, y: HIP - mix(runRise(stride), 8 + LIFT * 4 * u * (1 - u), inside) },
    };
  }
  return base;
};

const READY: Pose = { ...POSES.stand, rot: 8, lean: 10, legA: 22, kneeA: 30, legB: -16, kneeB: 26 };

const frame = (t: number): Frame => {
  if (t <= AT.run) {
    // Sur la ligne : debout, puis ramassé vers l'avant.
    const u = smooth(0.02, AT.run, t);
    return { pose: blend(POSES.stand, READY, u), root: { x: START, y: mix(HIP, run(START).root.y, u) } };
  }
  if (t < AT.stop) {
    const frame = moving(x(t));
    const u = smooth(AT.run, AT.run + 0.03, t);
    return u >= 1 ? frame : { pose: blend(READY, frame.pose, u), root: frame.root };
  }
  const last = moving(END);
  if (t < AT.stand) {
    const u = smooth(AT.stop, AT.stand, t);
    return { pose: blend(last.pose, POSES.stand, u), root: { x: END, y: mix(last.root.y, HIP, u) } };
  }
  return { pose: blend(POSES.stand, POSES.cheer, smooth(AT.stand, AT.cheer, t)), root: { x: END, y: HIP } };
};

export const HURDLES_TIMES = AT;

const when = (at: number) => timeWhen(x, at, AT.run, AT.stop);
const [first, second] = HURDLES;
const PHASES: Phase[] = [
  { name: "ready", from: 0, to: AT.run },
  { name: "approach", from: AT.run, to: when(first - BEFORE) },
  { name: "clearance", from: when(first - BEFORE), to: when(first + AFTER) },
  { name: "approach", from: when(first + AFTER), to: when(second - BEFORE) },
  { name: "clearance", from: when(second - BEFORE), to: when(second + AFTER) },
  { name: "landing", from: when(second + AFTER), to: AT.stand },
  { name: "celebrate", from: AT.stand, to: 1 },
];

// Une haie vue de trois quarts : la latte, ses deux montants, leurs pieds tournés vers le coureur.
const hurdle = (at: number): PropShape[] => {
  const far = { x: at - 30, y: HURDLE_TOP - 12 };
  const near = { x: at + 30, y: HURDLE_TOP + 12 };
  const foot = (top: { x: number; y: number }, ground: number): PropShape[] => [
    { kind: "line", from: top, to: { x: top.x, y: ground }, width: 7, paint: "post" },
    { kind: "line", from: { x: top.x - 36, y: ground }, to: { x: top.x, y: ground }, width: 7, paint: "post" },
  ];
  return [
    ...foot(far, STAGE.ground - 10),
    ...foot(near, STAGE.ground + 14),
    { kind: "line", from: far, to: near, width: 13, paint: "hurdle" },
  ];
};
const PROPS: PropShape[] = [laneLine(STAGE), ...HURDLES.flatMap(hurdle)];

export const HURDLES_CLIP: EventClip = {
  id: "hurdles",
  stage: STAGE,
  duration: 3400,
  phases: PHASES,
  still: when(first - 10),
  frame: (t) => frame(clamp(t)),
  props: () => PROPS,
  face: faceBy(AT.run, AT.stand),
};

// Pour le jeu (packages/game) : le coureur sans décor. `distance` est le chemin parcouru en pixels de la scène, qui
// règle la foulée ; `flight` va de 0 à 1 pendant un saut, `null` au sol. Le saut reprend les clés du geste, avec un
// fondu aux deux bords pour que l'appel et la réception partent de la foulée en cours.
const GAME_KEYS = clearance(HURDLES[0]);

export const hurdlerPose = (distance: number, flight: number | null): Pose => {
  const running = run(START + distance).pose;
  if (flight === null || flight <= 0 || flight >= 1) return running;
  const u = 0.1 + 0.8 * flight;
  const inside = smooth(0, 0.18, flight) * (1 - smooth(0.82, 1, flight));
  return blend(running, { ...samplePose(GAME_KEYS, u), sx: 1, sy: 1 }, inside);
};

// Le bassin, mesuré depuis le pied le plus bas, en pixels de la scène : posé à cette hauteur au-dessus du sol, le
// coureur a toujours un pied sur la piste, quelle que soit la foulée.
const SOLE = 6;
export const hurdlerHipAbove = (pose: Pose) => {
  const joints = jointPositions(pose);
  return Math.max(joints.footA.y, joints.footB.y) + SOLE;
};
// L'échelle de la scène : la latte d'une haie de 1,067 m est à 118 pixels du sol.
export const HURDLE_PX_PER_M = 118 / 1.067;
