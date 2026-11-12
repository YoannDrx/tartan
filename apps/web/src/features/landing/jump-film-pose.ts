// Le script du film : un relais de trois athlètes, ses seuils, ses repères, sa traînée, ses confettis et ses mondes.
// Les gestes eux-mêmes (squelette, poses, trajectoires, accessoires) viennent de @tartan/mascot.
import type { Surface } from "@tartan/design-tokens/athletes";
import type { AthleteId } from "@tartan/mascot/athletes";
import { clamp, mix, smooth } from "@tartan/mascot/clip";
import { phaseAt } from "@tartan/mascot/event";
import { CLIPS } from "@tartan/mascot/events";
import { HIGH_JUMP_STAGE, highJumpAt, type HighJumpPhase } from "@tartan/mascot/high-jump";
import { POLE_VAULT_TIMES } from "@tartan/mascot/pole-vault";
import type { PropShape } from "@tartan/mascot/props";
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

// Le film entier, de 0 à 1 sur le défilement. Trois athlètes se relaient, un par promesse : Inès aux haies
// (« Tu vois ce qui arrive »), Malo à la perche (« Tu sais ce que tu travailles »), Noé à la hauteur
// (« Tu sais sur quoi t'appliquer »), jusqu'à la validation.
export const FILM = {
  // Le titre de la page, l'athlète sur sa ligne.
  hurdles: 0.06,
  poleVault: 0.28,
  highJump: 0.48,
  // La réception dans le tapis : la séance est validée.
  impact: 0.8,
  finish: 0.9,
};

// Le saut en hauteur entre dans le film en pleine course, et y garde ses propres seuils.
const HIGH_JUMP_ENTRY = 0.2;
export const highJumpTime = (t: number) => {
  if (t <= FILM.impact) {
    return mix(HIGH_JUMP_ENTRY, T.impact, clamp((t - FILM.highJump) / (FILM.impact - FILM.highJump)));
  }
  if (t <= FILM.finish) return mix(T.impact, T.finish, (t - FILM.impact) / (FILM.finish - FILM.impact));
  return mix(T.finish, 1, clamp((t - FILM.finish) / (1 - FILM.finish)));
};

const HURDLES = CLIPS.hurdles;
const POLE_VAULT = CLIPS.poleVault;
// Les haies : du départ à la reprise d'appui après la seconde haie.
const HURDLES_END = HURDLES.phases.filter((phase) => phase.name === "clearance").at(-1)!.to;
// La perche : de la course perche en main jusqu'au corps renversé le long de la perche. Le relais passe avant
// le retournement, où le corps, vu par la tranche, ne se lit plus.
const POLE_VAULT_RANGE = [0.2, POLE_VAULT_TIMES.invert + 0.02] as const;
// Le sol de la perche est plus bas que celui du film : la scène remonte d'autant.
const POLE_VAULT_LIFT = GROUND - POLE_VAULT.stage.ground;

export type SceneId = "hurdles" | "poleVault" | "highJump";
export const SCENES: ReadonlyArray<{ id: SceneId; athlete: AthleteId }> = [
  { id: "hurdles", athlete: "hurdles" },
  { id: "poleVault", athlete: "poleVault" },
  { id: "highJump", athlete: "highJump" },
];
export const sceneAt = (t: number): SceneId =>
  t < FILM.poleVault ? "hurdles" : t < FILM.highJump ? "poleVault" : "highJump";

const lifted = (shape: PropShape, dy: number): PropShape =>
  shape.kind === "line"
    ? { ...shape, from: { x: shape.from.x, y: shape.from.y + dy }, to: { x: shape.to.x, y: shape.to.y + dy } }
    : shape.kind === "curve"
      ? {
          ...shape,
          from: { x: shape.from.x, y: shape.from.y + dy },
          control: { x: shape.control.x, y: shape.control.y + dy },
          to: { x: shape.to.x, y: shape.to.y + dy },
        }
      : { ...shape, y: shape.y + dy };

// L'instant du geste joué à une position du film, pour les deux premières scènes.
const hurdlesTime = (t: number) => clamp((t - FILM.hurdles) / (FILM.poleVault - FILM.hurdles)) * HURDLES_END;
const poleVaultTime = (t: number) =>
  mix(POLE_VAULT_RANGE[0], POLE_VAULT_RANGE[1], clamp((t - FILM.poleVault) / (FILM.highJump - FILM.poleVault)));

// Les accessoires d'une scène, dans le repère du film. La perche change à chaque image, le reste ne bouge pas.
export const sceneProps = (id: Exclude<SceneId, "highJump">, t: number): PropShape[] =>
  id === "hurdles"
    ? HURDLES.props(hurdlesTime(t)).filter((shape) => shape.paint !== "lane")
    : POLE_VAULT.props(poleVaultTime(t))
        .filter((shape) => shape.paint !== "lane")
        .map((shape) => lifted(shape, POLE_VAULT_LIFT));

export type FilmFrame = { scene: SceneId; pose: FilmPose; face: Face; running: boolean };

// t (de 0 à 1, la position du défilement) donne une image unique, à l'aller comme au retour.
export const frameAt = (t: number): FilmFrame => {
  const scene = sceneAt(t);
  if (scene === "highJump") {
    const time = highJumpTime(t);
    return {
      scene,
      pose: poseAt(time),
      face: time < T.finish ? "effort" : "joy",
      running: time < T.plant,
    };
  }
  const clip = scene === "hurdles" ? HURDLES : POLE_VAULT;
  const time = scene === "hurdles" ? hurdlesTime(t) : poleVaultTime(t);
  const { pose, root } = clip.frame(time);
  return {
    scene,
    pose: { ...pose, x: root.x, y: root.y + (scene === "poleVault" ? POLE_VAULT_LIFT : 0) },
    face: clip.face(time),
    running: phaseAt(clip, time).name === "approach" && t > FILM.hurdles + 0.02,
  };
};

// Le monde et le texte à l'écran pour une position donnée. Les changements sont francs, jamais en fondu.
export type FilmWorld = "piste" | "couloir" | "craie" | "nuit" | "coche";
export const WORLD_AT = (t: number): FilmWorld => {
  if (t < FILM.hurdles) return "piste";
  if (t < FILM.poleVault) return "couloir";
  if (t < FILM.highJump) return "craie";
  if (t < FILM.impact) return "nuit";
  if (t < FILM.finish) return "coche";
  return "piste";
};
// Le fond de chaque monde, pour habiller l'athlète qui le traverse.
export const WORLD_SURFACE: Record<FilmWorld, Surface> = {
  piste: "piste",
  couloir: "lane",
  craie: "chalk",
  nuit: "ink",
  coche: "lime",
};
export const BEAT_AT = (t: number) => {
  if (t < FILM.hurdles) return 0;
  if (t < FILM.poleVault) return 1;
  if (t < FILM.highJump) return 2;
  if (t < FILM.impact) return 3;
  if (t < FILM.finish) return 4;
  return 5;
};
// L'image fixe du film, sans mouvement : Noé au-dessus de la barre.
export const FILM_STILL = mix(FILM.highJump, FILM.impact, (T.apex - HIGH_JUMP_ENTRY) / (T.impact - HIGH_JUMP_ENTRY));
