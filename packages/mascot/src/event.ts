// Ce qu'est une épreuve pour un rendu : une scène, des phases, et pour chaque instant le corps, les accessoires et le visage.
import { clamp, mix, runPose, runRise, sample, samplePose, smooth, type Frame, type Key } from "./clip";
import { POSES } from "./poses";
import type { PropShape } from "./props";
import type { Face } from "./rig";
import { BODY, jointPositions, type Anchor, type Point, type Pose } from "./skeleton";

export const EVENT_IDS = ["hurdles", "poleVault", "tripleJump", "discus", "longJump", "highJump"] as const;
export type EventId = (typeof EVENT_IDS)[number];

// La scène, dans les unités du squelette. `ground` : la hauteur du sol.
export type Stage = { width: number; height: number; ground: number };

export type PhaseName =
  | "ready"
  | "approach"
  | "clearance"
  | "gather"
  | "plant"
  | "takeoff"
  | "swing"
  | "hop"
  | "step"
  | "jump"
  | "windup"
  | "turn"
  | "release"
  | "flight"
  | "landing"
  | "celebrate";

export type Phase = { name: PhaseName; from: number; to: number };

// Un geste complet, de 0 à 1. Un film ou un jeu choisit l'instant ; rien ici ne dépend d'une horloge.
export type EventClip = {
  id: EventId;
  stage: Stage;
  // Durée conseillée d'une lecture à vitesse réelle, en millisecondes.
  duration: number;
  phases: readonly Phase[];
  // L'instant le plus parlant du geste : l'image fixe d'une affiche, ou du mouvement réduit.
  still: number;
  frame(t: number): Frame;
  props(t: number): PropShape[];
  face(t: number): Face;
};

export const phaseAt = (clip: EventClip, t: number): Phase =>
  clip.phases.find((phase) => t < phase.to) ?? clip.phases[clip.phases.length - 1]!;

// La hauteur du bassin d'un corps debout sur ce sol.
export const hipOn = (ground: number) => ground - BODY.thigh - BODY.shin - 16;

// Une clé : un instant, la position du bassin, et ce qui change dans la pose par rapport à la station debout.
export type Moment = { t: number; root: Point; pose: Pose };
export const moment = (t: number, root: Point, patch: Partial<Pose> = {}): Moment => ({
  t,
  root,
  pose: { ...POSES.stand, ...patch },
});

// Deux pistes par suite de clés : les angles d'un côté, le bassin de l'autre.
export const tracks = (moments: readonly Moment[]) => {
  const pose = moments.map(({ t, pose }): Key<Pose> => ({ t, v: pose }));
  const root = moments.map(({ t, root }): Key<Point> => ({ t, v: root }));
  return { frame: (t: number): Frame => ({ pose: samplePose(pose, t), root: sample(root, t) }) };
};

// La longueur d'un appui de course : la foulée avance avec le corps, donc les pieds ne glissent pas.
export const STEP = 120;

// Le corps qui court à l'abscisse `x`, sur une ligne partie de `from`. `phase` décale le premier appui.
export const runFrame = (x: number, from: number, hip: number, phase = 0): Frame => {
  const stride = phase + ((x - from) / STEP) * Math.PI;
  return { pose: { ...runPose(stride), rot: 8 }, root: { x, y: hip - runRise(stride) } };
};

// La part du chemin parcourue à l'instant `u` d'une course : on accélère, on tient sa vitesse, on freine.
// `brake` à 0 : la course arrive lancée, comme sur une planche d'appel.
export const cruise = (u: number, launch = 0.18, brake = 0) => {
  const v = clamp(u);
  const total = launch / 2 + (1 - launch - brake) + brake / 2;
  const done =
    v < launch
      ? (v * v) / (2 * launch)
      : v <= 1 - brake
        ? launch / 2 + (v - launch)
        : total - ((1 - v) * (1 - v)) / (2 * brake);
  return done / total;
};

// L'instant où une fonction croissante du temps atteint `value`, entre `t0` et `t1`.
export const timeWhen = (at: (t: number) => number, value: number, t0: number, t1: number) => {
  let [low, high] = [t0, t1];
  for (let i = 0; i < 40; i += 1) {
    const middle = (low + high) / 2;
    if (at(middle) < value) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
};

// Deux clés tirées de la course, pour que les clés suivantes partent à sa vitesse, sans à-coup.
export const runIn = (t: number, frame: (t: number) => Frame, lead = 0.012): Moment[] => [
  { t: t - lead, ...frame(t - lead) },
  { t, ...frame(t) },
];

// Le bassin qu'il faut pour qu'une main, un pied ou la tête soit exactement à `target`.
export const pinned = (pose: Pose, anchor: Anchor, target: Point): Point => {
  const at = jointPositions(pose)[anchor];
  return { x: target.x - at.x, y: target.y - at.y };
};

// Une parabole entre deux points, qui monte de `rise` au-dessus de la droite qui les relie.
export const arc = (from: Point, to: Point, rise: number, u: number): Point => ({
  x: mix(from.x, to.x, u),
  y: mix(from.y, to.y, u) - rise * 4 * u * (1 - u),
});

// La ligne blanche du bord de piste, d'un bout à l'autre de la scène.
export const laneLine = (stage: Stage, from = 0, to = stage.width): PropShape => ({
  kind: "line",
  from: { x: from, y: stage.ground + 22 },
  to: { x: to, y: stage.ground + 22 },
  width: 5,
  cap: "butt",
  paint: "lane",
});

// Le visage suit le geste : neutre avant, à l'effort pendant, joyeux une fois le geste réussi.
export const faceBy =
  (effortFrom: number, joyFrom: number) =>
  (t: number): Face =>
    t < effortFrom ? "neutral" : t < joyFrom ? "effort" : "joy";

// La réception dans le sable, commune aux sauts horizontaux : les talons touchent, le bassin passe par-dessus,
// l'athlète s'accroupit, puis se relève les bras en l'air. `heel` : où les talons entrent dans le sable.
export const sandLanding = (
  at: { touch: number; crouch: number; squat: number; cheer: number },
  heel: Point,
): Moment[] => {
  const foot = (dx: number): Point => ({ x: heel.x + dx, y: heel.y });
  const key = (t: number, dx: number, patch: Partial<Pose>): Moment => {
    const pose = { ...POSES.stand, ...patch };
    return { t, pose, root: pinned(pose, "footA", foot(dx)) };
  };
  return [
    key(at.touch, 0, {
      rot: -16,
      lean: 46,
      head: 8,
      armA: 62,
      elbowA: 6,
      armB: 54,
      elbowB: 6,
      legA: 46,
      kneeA: 18,
      legB: 52,
      kneeB: 22,
    }),
    key(at.crouch, 4, {
      sx: 1.08,
      sy: 0.88,
      lean: 36,
      head: 4,
      armA: 70,
      elbowA: 20,
      armB: 60,
      elbowB: 20,
      legA: 72,
      kneeA: 122,
      legB: 78,
      kneeB: 126,
    }),
    key(at.squat, 8, {
      lean: 18,
      armA: 34,
      elbowA: 30,
      armB: 22,
      elbowB: 30,
      legA: 52,
      kneeA: 100,
      legB: 58,
      kneeB: 104,
    }),
    key(at.cheer, 8, { ...POSES.cheer, sx: 0.96, sy: 1.05 }),
    key(at.cheer + 0.2, 8, POSES.cheer),
  ];
};

// Un pied au sol ne bouge pas : entre la pose et l'impulsion, le bassin se déduit de lui à chaque image.
// `u` : l'avancement de l'appui, de 0 à 1.
export const planted = (pose: Pose, anchor: Anchor, from: Point, to: Point, u: number): Frame => ({
  pose,
  root: pinned(pose, anchor, { x: mix(from.x, to.x, u), y: mix(from.y, to.y, u) }),
});

// Une fois dans le sable, les pieds ne bougent presque plus : le bassin se déduit d'eux à chaque image,
// sans quoi ils s'enfonceraient entre deux clés.
export const sandFrame = (pose: Pose, t: number, at: { touch: number; squat: number }, heel: Point): Frame => ({
  pose,
  root: pinned(pose, "footA", { x: heel.x + 8 * smooth(at.touch, at.squat, t), y: heel.y }),
});

// Une fosse de sable : le fond derrière l'athlète, et une frange devant lui où ses pieds s'enfoncent.
export const sandPit = (stage: Stage, from: number, to: number): PropShape[] => [
  { kind: "rect", x: from, y: stage.ground - 4, width: to - from, height: 64, radius: 6, paint: "sand" },
  { kind: "rect", x: from, y: stage.ground + 4, width: to - from, height: 56, radius: 6, paint: "sand", front: true },
];

// La planche d'appel et sa plasticine, juste avant la ligne à ne pas mordre.
export const takeoffBoard = (stage: Stage, foul: number): PropShape[] => [
  { kind: "rect", x: foul - 40, y: stage.ground - 2, width: 40, height: 14, radius: 3, paint: "board" },
  { kind: "rect", x: foul, y: stage.ground - 2, width: 12, height: 14, radius: 3, paint: "foul" },
];
