// Le script du film : le saut en hauteur de Noé, ses seuils, ses repères, sa traînée, ses confettis et ses mondes.
// Le geste lui-même (squelette, poses, trajectoire) vient de @tartan/mascot.
import type { Surface } from "@tartan/design-tokens/athletes";
import { mix, smooth } from "@tartan/mascot/clip";
import { HIGH_JUMP_STAGE, highJumpAt, type HighJumpPhase } from "@tartan/mascot/high-jump";
import type { Face } from "@tartan/mascot/rig";
import type { Point, Pose } from "@tartan/mascot/skeleton";

export const GROUND = HIGH_JUMP_STAGE.ground;
export const MAT_TOP = HIGH_JUMP_STAGE.matTop;
export const IMPACT = HIGH_JUMP_STAGE.impact;
export const BAR = { farX: 830, farY: 270, nearX: 1270, nearY: 190 };

// Les seuils du saut en hauteur, sur sa durée propre. Le franchissement en occupe un long tronçon : c'est lui, le ralenti.
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

// Le saut en hauteur seul : t (de 0 à 1, sur sa durée propre) donne une pose unique, à l'aller comme au retour.
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

// Le film entier, de 0 à 1 sur le défilement : un seul athlète, Noé, et un seul geste, le saut en hauteur. Chaque
// promesse accompagne une phase du saut : l'élan (« Tu vois ce qui arrive »), l'appel (« Tu sais ce que tu
// travailles »), le franchissement (« Tu sais sur quoi t'appliquer »), puis la réception, la validation.
export const FILM = {
  // Le titre de la page, l'athlète sur sa ligne.
  start: 0.06,
  // L'appel, puis le franchissement.
  plant: 0.3,
  flight: 0.5,
  // La réception dans le tapis : la séance est validée.
  impact: 0.8,
  finish: 0.9,
};

// Les repères du défilement et l'instant du saut qui leur correspond : le saut garde ses propres seuils.
const KNOTS: ReadonlyArray<readonly [film: number, jump: number]> = [
  [FILM.start, 0],
  [FILM.plant, T.runEnd],
  [FILM.flight, T.takeoff],
  [FILM.impact, T.impact],
  [FILM.finish, T.finish],
  [1, 1],
];
export const highJumpTime = (t: number) => {
  if (t <= FILM.start) return 0;
  for (let i = 1; i < KNOTS.length; i++) {
    const [from, at] = KNOTS[i - 1]!;
    const [to, next] = KNOTS[i]!;
    if (t <= to) return mix(at, next, (t - from) / (to - from));
  }
  return 1;
};

export type FilmFrame = { pose: FilmPose; face: Face; running: boolean };

// t (de 0 à 1, la position du défilement) donne une image unique, à l'aller comme au retour.
export const frameAt = (t: number): FilmFrame => {
  const time = highJumpTime(t);
  return {
    pose: poseAt(time),
    face: time < T.run ? "neutral" : time < T.finish ? "effort" : "joy",
    running: time > T.run && time < T.plant,
  };
};

// Le monde et le texte à l'écran pour une position donnée. Les changements sont francs, jamais en fondu.
export type FilmWorld = "piste" | "couloir" | "craie" | "nuit" | "coche";
const BEATS = [FILM.start, FILM.plant, FILM.flight, FILM.impact, FILM.finish];
const WORLDS: readonly FilmWorld[] = ["piste", "couloir", "craie", "nuit", "coche", "piste"];
export const BEAT_AT = (t: number) => {
  const next = BEATS.findIndex((at) => t < at);
  return next === -1 ? BEATS.length : next;
};
export const WORLD_AT = (t: number): FilmWorld => WORLDS[BEAT_AT(t)]!;
// Le fond de chaque monde, pour habiller l'athlète qui le traverse.
export const WORLD_SURFACE: Record<FilmWorld, Surface> = {
  piste: "piste",
  couloir: "lane",
  craie: "chalk",
  nuit: "ink",
  coche: "lime",
};
// L'image fixe du film, sans mouvement : Noé au-dessus de la barre.
export const FILM_STILL = mix(FILM.flight, FILM.impact, (T.apex - T.takeoff) / (T.impact - T.takeoff));
