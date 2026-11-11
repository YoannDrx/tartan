// Le script du film : ses seuils, ses repères, sa traînée, ses confettis et ses mondes.
// Le saut lui-même (squelette, poses, trajectoire) vient de @tartan/mascot.
import { mix, smooth } from "@tartan/mascot/clip";
import { HIGH_JUMP_STAGE, highJumpAt, type HighJumpPhase } from "@tartan/mascot/high-jump";
import type { Point, Pose } from "@tartan/mascot/skeleton";

export const GROUND = HIGH_JUMP_STAGE.ground;
export const MAT_TOP = HIGH_JUMP_STAGE.matTop;
export const IMPACT = HIGH_JUMP_STAGE.impact;
export const BAR = { farX: 830, farY: 270, nearX: 1270, nearY: 190 };

// Les seuils du film. Le franchissement occupe un long tronçon du défilement : c'est lui, le ralenti.
export const T = {
  run: 0.115,
  runEnd: 0.36,
  plant: 0.4,
  takeoff: 0.455,
  apex: 0.63,
  impact: 0.775,
  filled: 0.805,
  finish: 0.9,
  // Fin de l'action, pour le compteur d'images.
  end: 0.9,
};

// Chaque phase du saut, étirée sur son tronçon du défilement.
const CUTS: Array<{ phase: HighJumpPhase; from: number; to: number }> = [
  { phase: "ready", from: 0, to: T.run },
  { phase: "approach", from: T.run, to: T.runEnd },
  { phase: "gather", from: T.runEnd, to: T.plant },
  { phase: "takeoff", from: T.plant, to: T.takeoff },
  { phase: "flight", from: T.takeoff, to: T.impact },
  { phase: "landing", from: T.impact, to: T.finish },
  { phase: "celebrate", from: T.finish, to: 1 },
];

// Le personnage dans la scène : sa pose, et la position de son bassin.
export type FilmPose = Pose & Point;

// t (de 0 à 1, la position du défilement) donne une pose unique, à l'aller comme au retour.
export const poseAt = (t: number): FilmPose => {
  const cut = CUTS.find(({ to }) => t < to) ?? CUTS[CUTS.length - 1]!;
  const { pose, root } = highJumpAt(cut.phase, (t - cut.from) / (cut.to - cut.from));
  return { ...pose, ...root };
};

// La ligne de couloir qui décolle : au sol pendant la course, puis elle suit le bassin jusqu'au tapis.
const TRAIL_STEPS = 140;
const trailPoints = Array.from({ length: TRAIL_STEPS + 1 }, (_, i) => {
  const t = T.run + ((T.impact - T.run) * i) / TRAIL_STEPS;
  const { x, y } = poseAt(t);
  return { t, x, y: mix(GROUND + 6, y, smooth(T.plant, T.takeoff + 0.012, t)) };
});
export const TRAIL_PATH = `M -60 ${GROUND + 6} ${trailPoints.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")}`;

const trailLengths = trailPoints.reduce<number[]>((all, point, i) => {
  const previous = trailPoints[i - 1];
  const step = previous ? Math.hypot(point.x - previous.x, point.y - previous.y) : point.x + 60;
  all.push((all[i - 1] ?? 0) + step);
  return all;
}, []);
export const TRAIL_LENGTH = trailLengths[trailLengths.length - 1] ?? 1;

export const trailAt = (t: number) => {
  if (t <= T.run) return 0;
  if (t >= T.impact) return TRAIL_LENGTH;
  const at = ((t - T.run) / (T.impact - T.run)) * TRAIL_STEPS;
  const i = Math.floor(at);
  return mix(trailLengths[i] ?? 0, trailLengths[i + 1] ?? TRAIL_LENGTH, at - i);
};

// La barre tremble après le passage du corps, sans tomber.
export const barWobble = (t: number) => {
  const since = t - T.apex - 0.03;
  if (since <= 0 || t >= T.filled) return 0;
  return 1.5 * Math.exp(-since / 0.045) * Math.sin(since * 150);
};

// Confettis à l'impact : même graine à chaque rendu, donc identiques côté serveur et à l'aller-retour.
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const random = seeded(4242);
export const CONFETTI = Array.from({ length: 42 }, (_, i) => {
  const angle = -Math.PI * (0.06 + 0.88 * random());
  const speed = 380 + 900 * random();
  return {
    kind: i % 3,
    color: i % 5,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    spin: (random() - 0.5) * 900,
    size: 12 + 18 * random(),
  };
});
export const confettiAt = (piece: (typeof CONFETTI)[number], t: number) => {
  const d = (t - T.impact) / 0.11;
  return {
    x: IMPACT.x + piece.vx * d,
    y: IMPACT.y + piece.vy * d + 620 * d * d,
    rot: piece.spin * d,
  };
};

// Le monde et le texte à l'écran pour une position donnée. Les changements sont francs, jamais en fondu.
export const WORLD_AT = (t: number) => {
  if (t < 0.1) return "piste";
  if (t < 0.345) return "couloir";
  if (t < 0.5) return "craie";
  if (t < T.impact) return "nuit";
  if (t < T.finish) return "coche";
  return "piste";
};
export const BEAT_AT = (t: number) => {
  if (t < 0.1) return 0;
  if (t < 0.345) return 1;
  if (t < 0.5) return 2;
  if (t < T.impact) return 3;
  if (t < T.finish) return 4;
  return 5;
};
