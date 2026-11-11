// Le disque : des élans, une volte et demie dans le cercle, puis le bras qui fouette et le disque qui part.
import { clamp, type Frame } from "./clip";
import { arc, faceBy, hipOn, laneLine, moment, tracks, type EventClip, type Moment, type Phase } from "./event";
import { POSES } from "./poses";
import type { PropShape } from "./props";
import { jointPositions, type Point, type Pose } from "./skeleton";

const STAGE = { width: 1400, height: 800, ground: 740 };
const HIP = hipOn(STAGE.ground);
// Le cercle, vu de profil : un trait au sol. Le disque retombe dans le secteur, loin devant.
export const DISCUS = { circle: { from: 236, to: 500 }, landing: { x: 1290, y: STAGE.ground + 8 }, rise: 250 };

const AT = {
  stance: 0.09,
  windup: 0.27,
  turn: 0.3,
  power: 0.55,
  release: 0.6,
  follow: 0.66,
  recover: 0.74,
  land: 0.88,
  cheer: 0.95,
};

// Jambes fléchies, le poids bas : la position de tout le lancer.
const LOW: Partial<Pose> = { sx: 1.04, sy: 0.94, legA: 16, kneeA: 28, legB: -16, kneeB: 28 };
const at = (x: number, lift = 0): Point => ({ x, y: HIP + 12 - lift });

// Dos au secteur au départ (`flip` à −1). Chaque demi-tour retourne le corps, comme une carte.
const KEYS: Moment[] = [
  moment(-0.1, { x: 330, y: HIP }, { flip: -1, armA: 6, elbowA: 6 }),
  moment(0, { x: 330, y: HIP }, { flip: -1, armA: 6, elbowA: 6 }),
  moment(AT.stance, at(330), { ...LOW, flip: -1, armA: 24, elbowA: 6, armB: 40, elbowB: 60 }),
  // Élans : le disque part devant, puis loin derrière, le buste avec lui.
  moment(0.16, at(326), { ...LOW, flip: -1, lean: 10, armA: 84, elbowA: 4, armB: -34, elbowB: 40 }),
  moment(0.215, at(334), { ...LOW, flip: -1, lean: -6, rot: -3, armA: -70, elbowA: 4, armB: 64, elbowB: 50 }),
  moment(AT.windup, at(332), {
    ...LOW,
    flip: -1,
    sy: 0.9,
    lean: -10,
    rot: -5,
    armA: -98,
    elbowA: 0,
    armB: 72,
    elbowB: 52,
    kneeA: 36,
    kneeB: 36,
  }),
  // Volte : trois demi-tours en traversant le cercle, le disque toujours à la traîne.
  moment(0.345, at(350, 4), {
    ...LOW,
    flip: 1,
    armA: -92,
    armB: 60,
    elbowB: 40,
    legA: 4,
    kneeA: 20,
    legB: 34,
    kneeB: 78,
  }),
  moment(0.415, at(382, 26), {
    ...LOW,
    flip: -1,
    sy: 1,
    armA: -96,
    armB: 54,
    elbowB: 44,
    legA: 30,
    kneeA: 70,
    legB: -8,
    kneeB: 30,
  }),
  moment(0.485, at(414, 8), {
    ...LOW,
    flip: 1,
    armA: -100,
    armB: 58,
    elbowB: 40,
    legA: -6,
    kneeA: 24,
    legB: 30,
    kneeB: 64,
  }),
  // Position de force : face au secteur, le poids en arrière, le bras le plus loin possible.
  moment(AT.power, at(438), {
    ...LOW,
    rot: -11,
    lean: -6,
    head: 4,
    armA: -112,
    elbowA: 0,
    armB: 64,
    elbowB: 30,
    legA: 24,
    kneeA: 22,
    legB: -24,
    kneeB: 34,
  }),
  // Le fouetté : la main passe près de la hanche, puis file devant.
  moment(0.577, at(450, 2), {
    rot: -2,
    lean: 0,
    armA: -30,
    elbowA: 64,
    armB: 10,
    elbowB: 70,
    legA: 16,
    kneeA: 12,
    legB: -26,
    kneeB: 26,
  }),
  moment(AT.release, at(462, 14), {
    rot: 7,
    sy: 1.06,
    lean: 6,
    head: -6,
    armA: 58,
    elbowA: 2,
    armB: -44,
    elbowB: 70,
    legA: 8,
    kneeA: 4,
    legB: -30,
    kneeB: 18,
  }),
  // Reprise d'appui : la jambe arrière se lève pour ne pas sortir du cercle.
  moment(AT.follow, at(474, 18), {
    rot: 13,
    lean: 8,
    armA: 126,
    elbowA: 24,
    armB: -60,
    elbowB: 40,
    legA: -34,
    kneeA: 66,
    legB: 12,
    kneeB: 14,
  }),
  moment(AT.recover, { x: 466, y: HIP }, { rot: 2, head: -8, armA: 30, elbowA: 30, armB: -8, elbowB: 24 }),
  // Il suit le disque des yeux.
  moment(AT.land, { x: 466, y: HIP }, { head: -10, armA: 16, elbowA: 24, armB: -10, elbowB: 20 }),
  moment(AT.cheer, { x: 466, y: HIP }, { ...POSES.cheer, sx: 0.96, sy: 1.05 }),
  moment(1.1, { x: 466, y: HIP }, POSES.cheer),
];
const THROW = tracks(KEYS);
const frame = (t: number): Frame => THROW.frame(clamp(t));

// Le disque : dans la main tant qu'elle le tient, puis sur sa parabole, puis posé là où il est retombé.
const RELEASED = jointPositions(frame(AT.release).pose, frame(AT.release).root).handA;
export const discusAt = (t: number): Point => {
  if (t <= AT.release) {
    const { pose, root } = frame(t);
    return jointPositions(pose, root).handA;
  }
  return arc(RELEASED, DISCUS.landing, DISCUS.rise, clamp((t - AT.release) / (AT.land - AT.release)));
};

const MARKS = [760, 940, 1120].map((x): PropShape => ({
  kind: "rect",
  x,
  y: STAGE.ground + 12,
  width: 5,
  height: 20,
  paint: "lane",
}));
const GROUND: PropShape[] = [
  {
    kind: "line",
    from: { x: DISCUS.circle.from, y: STAGE.ground + 22 },
    to: { x: DISCUS.circle.to, y: STAGE.ground + 22 },
    width: 12,
    paint: "lane",
  },
  laneLine(STAGE, DISCUS.circle.to + 40),
  ...MARKS,
];
const props = (t: number): PropShape[] => {
  const disc = discusAt(t);
  // Dans la main, le disque passe devant le corps ; en l'air, peu importe.
  return [
    ...GROUND,
    { kind: "rect", x: disc.x - 28, y: disc.y - 8, width: 56, height: 16, radius: 8, paint: "discus", front: true },
  ];
};

const PHASES: Phase[] = [
  { name: "ready", from: 0, to: AT.stance },
  { name: "windup", from: AT.stance, to: AT.turn },
  { name: "turn", from: AT.turn, to: AT.power },
  { name: "release", from: AT.power, to: AT.follow },
  { name: "flight", from: AT.follow, to: AT.land },
  { name: "celebrate", from: AT.land, to: 1 },
];

export const DISCUS_CLIP: EventClip = {
  id: "discus",
  stage: STAGE,
  duration: 4600,
  phases: PHASES,
  still: AT.power,
  frame,
  props,
  face: faceBy(AT.stance, AT.land),
};
export const DISCUS_TIMES = AT;
