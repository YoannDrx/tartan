// Le saut en hauteur, en fonctions pures : une phase et sa progression (de 0 à 1) donnent une image unique.
import { blend, clamp, mix, runPose, runRise, sample, samplePose, smooth, type Frame, type Key } from "./clip";
import { POSES } from "./poses";
import { BODY, type Point, type Pose } from "./skeleton";

// Les repères de l'aire de saut, dans les unités où le bassin se déplace : le sol, le dessus du tapis, le point de chute.
export const HIGH_JUMP_STAGE = { ground: 740, matTop: 590, impact: { x: 1150, y: 545 } };

// Les instants du clip sur sa durée propre, de 0 à 1. Le franchissement en occupe un long tronçon : c'est lui, le ralenti.
const AT = { run: 0.115, runEnd: 0.36, plant: 0.4, takeoff: 0.455, apex: 0.63, impact: 0.775, finish: 0.9 };

// Les phases et leur tronçon du clip. Un film ou un jeu étire chacune comme il veut : il donne la phase et sa progression.
export const HIGH_JUMP_PHASES = {
  ready: [0, AT.run],
  approach: [AT.run, AT.runEnd],
  gather: [AT.runEnd, AT.plant],
  takeoff: [AT.plant, AT.takeoff],
  flight: [AT.takeoff, AT.impact],
  landing: [AT.impact, AT.finish],
  celebrate: [AT.finish, 1],
} as const satisfies Record<string, readonly [number, number]>;
export type HighJumpPhase = keyof typeof HIGH_JUMP_PHASES;

// Où se trouve l'apex dans la phase de vol.
export const HIGH_JUMP_APEX = (AT.apex - AT.takeoff) / (AT.impact - AT.takeoff);

const { ground, matTop, impact } = HIGH_JUMP_STAGE;
const HIP = ground - BODY.thigh - BODY.shin - 16;
const START: Point = { x: 190, y: HIP };
const STAND = POSES.stand;

// Trajectoire du bassin au-dessus de la barre : deux demi-paraboles autour de l'apex.
const arc = (u: number): Point => ({
  x: 745 + 405 * u,
  y: u <= 0.5 ? 105 + 335 * ((0.5 - u) / 0.5) ** 2 : 105 + 440 * ((u - 0.5) / 0.5) ** 2,
});

// La course d'élan : la foulée, le buste qui penche, puis l'avant-dernier appui plus bas.
const STRIDES = 9;
const approachPose = (u: number): Pose => ({
  ...runPose(u * Math.PI * STRIDES),
  rot: mix(6, 12, smooth(0, 0.3, u)) - 10 * smooth(0.82, 1, u),
});
const approachRoot = (u: number): Point => ({
  x: mix(START.x, 640, u * u * (1.6 - 0.6 * u)),
  y: HIP - runRise(u * Math.PI * STRIDES) + 16 * smooth(0.82, 1, u),
});

const ANTICIPATION: Pose = {
  ...STAND,
  sx: 1.1,
  sy: 0.88,
  rot: -7,
  lean: -5,
  armA: -38,
  elbowA: 60,
  armB: -48,
  elbowB: 60,
  legA: 26,
  kneeA: 38,
  legB: -18,
  kneeB: 32,
};
// Le temps que la course met à sortir de l'anticipation, en part de la phase d'élan.
const RELEASE = 0.03 / (AT.runEnd - AT.run);

// Une clé : un instant, la position du bassin, et ce qui change dans la pose par rapport à la station debout.
type Moment = { t: number; root: Point; pose: Pose };
const moment = (t: number, root: Point, patch: Partial<Pose> = {}): Moment => ({
  t,
  root,
  pose: { ...STAND, ...patch },
});

// Sur le dos, les jambes en l'air : la réception et ses rebonds.
const legsUp = (t: number, root: Point, rot: number, sx: number, sy: number) =>
  moment(t, root, { ...POSES.landing, rot, sx, sy });

const INTRO: Moment[] = [
  moment(-0.1, START),
  moment(0, START),
  moment(0.075, START),
  moment(AT.run, START, ANTICIPATION),
];

const JUMP: Moment[] = [
  { t: AT.runEnd, root: approachRoot(1), pose: approachPose(1) },
  // Dernier appui : le pied planté loin devant, le corps penché en arrière.
  moment(
    AT.plant,
    { x: 690, y: HIP + 34 },
    {
      rot: -16,
      sx: 1.12,
      sy: 0.86,
      lean: -6,
      head: 6,
      armA: -46,
      elbowA: 34,
      armB: -58,
      elbowB: 34,
      legA: 18,
      kneeA: 4,
      legB: -24,
      kneeB: 82,
    },
  ),
  // Impulsion : le genou libre monte, les bras avec lui.
  moment(
    0.43,
    { x: 716, y: HIP - 44 },
    {
      rot: -5,
      sx: 0.9,
      sy: 1.16,
      lean: 2,
      head: 2,
      armA: 150,
      elbowA: 18,
      armB: 128,
      elbowB: 20,
      legA: -7,
      kneeA: 4,
      legB: 92,
      kneeB: 104,
    },
  ),
  // Le dos se tourne vers la barre : le personnage se retourne, comme une carte.
  moment(AT.takeoff, arc(0), {
    rot: 10,
    flip: -1,
    sx: 0.88,
    sy: 1.2,
    lean: -2,
    armA: 170,
    elbowA: 8,
    armB: 96,
    elbowB: 26,
    legA: -4,
    kneeA: 18,
    legB: 62,
    kneeB: 86,
  }),
  moment(0.5, arc(0.17), {
    rot: 36,
    flip: -1,
    sx: 0.94,
    sy: 1.1,
    lean: -6,
    head: -6,
    armA: 174,
    elbowA: 8,
    armB: 62,
    elbowB: 22,
    legA: -6,
    kneeA: 30,
    legB: 22,
    kneeB: 66,
  }),
  moment(0.55, arc(0.37), {
    rot: 66,
    flip: -1,
    lean: -18,
    head: -14,
    armA: 112,
    elbowA: 12,
    armB: 40,
    elbowB: 16,
    legA: -14,
    kneeA: 58,
    legB: -8,
    kneeB: 66,
  }),
  // Apex : hanches au point haut, tête déjà de l'autre côté, tibias qui pendent.
  moment(0.6, arc(0.47), {
    rot: 90,
    flip: -1,
    lean: -24,
    head: -22,
    armA: 26,
    elbowA: 8,
    armB: 8,
    elbowB: 8,
    legA: -30,
    kneeA: 78,
    legB: -22,
    kneeB: 88,
  }),
  moment(AT.apex, arc(0.5), POSES.apex),
  moment(0.67, arc(0.55), {
    rot: 100,
    flip: -1,
    lean: -22,
    head: -18,
    armA: 24,
    elbowA: 8,
    armB: 8,
    elbowB: 8,
    legA: -16,
    kneeA: 74,
    legB: -8,
    kneeB: 82,
  }),
  // Dégagement : les jambes partent vers le haut, la tête tombe vers le tapis.
  moment(0.715, arc(0.68), {
    rot: 122,
    flip: -1,
    sx: 0.96,
    sy: 1.06,
    lean: -6,
    head: 8,
    armA: 58,
    elbowA: 10,
    armB: 42,
    elbowB: 10,
    legA: 58,
    kneeA: 18,
    legB: 66,
    kneeB: 12,
  }),
  moment(0.75, arc(0.87), {
    rot: 148,
    flip: -1,
    sx: 0.94,
    sy: 1.1,
    lean: 8,
    head: 14,
    armA: 84,
    elbowA: 10,
    armB: 66,
    elbowB: 10,
    legA: 78,
    kneeA: 16,
    legB: 84,
    kneeB: 12,
  }),
  legsUp(AT.impact, impact, 164, 1.26, 0.7),
  legsUp(0.79, { x: 1156, y: 552 }, 168, 1.34, 0.62),
  // Rebond dans le tapis, puis roulade arrière.
  legsUp(0.835, { x: 1168, y: 420 }, 176, 0.92, 1.12),
  legsUp(0.875, { x: 1180, y: 545 }, 170, 1.18, 0.78),
  legsUp(AT.finish, { x: 1186, y: 520 }, 188, 1, 1),
  moment(
    0.94,
    { x: 1190, y: matTop - 140 },
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
  // Debout sur le tapis, il regarde la barre restée en place, les bras en l'air.
  moment(0.97, { x: 1190, y: matTop - 146 }, { ...POSES.cheer, rot: 360, flip: -1, sx: 0.96, sy: 1.06 }),
  moment(1.1, { x: 1190, y: matTop - 144 }, { ...POSES.cheer, rot: 360, flip: -1 }),
];

// Deux pistes par suite de clés : les angles d'un côté, le bassin de l'autre.
const tracks = (moments: Moment[]) => ({
  pose: moments.map(({ t, pose }): Key<Pose> => ({ t, v: pose })),
  root: moments.map(({ t, root }): Key<Point> => ({ t, v: root })),
});
const INTRO_TRACKS = tracks(INTRO);
const JUMP_TRACKS = tracks(JUMP);

const timeOf = (phase: HighJumpPhase, progress: number) => {
  const [from, to] = HIGH_JUMP_PHASES[phase];
  return from + (to - from) * progress;
};

// La pose seule : les angles et l'orientation du corps, sans sa position.
export const highJumpPose = (phase: HighJumpPhase, progress: number): Pose => {
  if (phase === "ready") return samplePose(INTRO_TRACKS.pose, timeOf(phase, progress));
  if (phase !== "approach") return samplePose(JUMP_TRACKS.pose, timeOf(phase, progress));
  const release = smooth(0, RELEASE, progress);
  const run = approachPose(clamp(progress));
  return release >= 1 ? run : blend(ANTICIPATION, run, release);
};

// Le déplacement du bassin seul.
export const highJumpRoot = (phase: HighJumpPhase, progress: number): Point => {
  if (phase === "ready") return sample(INTRO_TRACKS.root, timeOf(phase, progress));
  if (phase !== "approach") return sample(JUMP_TRACKS.root, timeOf(phase, progress));
  const release = smooth(0, RELEASE, progress);
  const run = approachRoot(clamp(progress));
  return release >= 1 ? run : blend(START, run, release);
};

export const highJumpAt = (phase: HighJumpPhase, progress: number): Frame => ({
  pose: highJumpPose(phase, progress),
  root: highJumpRoot(phase, progress),
});
