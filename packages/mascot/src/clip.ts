// L'échantillonneur de clips : des clés posées dans le temps, une pose unique pour chaque instant, à l'aller comme au retour.
import type { Point, Pose } from "./skeleton";

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const mix = (a: number, b: number, u: number) => a + (b - a) * u;
export const smooth = (from: number, to: number, value: number) => {
  const u = clamp((value - from) / (to - from));
  return u * u * (3 - 2 * u);
};

// Une image d'un clip. Le déplacement du bassin est séparé des angles : un jeu peut garder les uns et piloter l'autre.
export type Frame = { pose: Pose; root: Point };

export type Key<V> = { t: number; v: V };
export type Track<V> = ReadonlyArray<Key<V>>;

// Catmull-Rom non uniforme : un léger dépassement sur les clés, voulu, donne le rebond du dessin animé.
// Avant la première clé et après la dernière, la valeur ne bouge plus.
export const sample = <V extends Record<string, number>>(track: Track<V>, t: number): V => {
  let i = 0;
  while (i < track.length - 2 && t > track[i + 1]!.t) i += 1;
  const k1 = track[i]!;
  const k2 = track[i + 1]!;
  const k0 = track[i - 1] ?? k1;
  const k3 = track[i + 2] ?? k2;
  const span = k2.t - k1.t;
  const u = clamp((t - k1.t) / span);
  const u2 = u * u;
  const u3 = u2 * u;
  const out: Record<string, number> = {};
  for (const key of Object.keys(k1.v)) {
    const [v0, v1, v2, v3] = [k0.v[key]!, k1.v[key]!, k2.v[key]!, k3.v[key]!];
    const m1 = k0 === k1 ? 0 : ((v2 - v0) / (k2.t - k0.t)) * span;
    const m2 = k3 === k2 ? 0 : ((v3 - v1) / (k3.t - k1.t)) * span;
    out[key] = (2 * u3 - 3 * u2 + 1) * v1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * v2 + (u3 - u2) * m2;
  }
  return out as V;
};

// Une pose échantillonnée : le retournement ne dépasse jamais le recto ni le verso.
export const samplePose = (track: Track<Pose>, t: number): Pose => {
  const pose = sample(track, t);
  pose.flip = clamp(pose.flip, -1, 1);
  return pose;
};

// Le passage d'une valeur à une autre, champ par champ.
export const blend = <V extends Record<string, number>>(from: V, to: V, u: number): V => {
  const out: Record<string, number> = {};
  for (const key of Object.keys(from)) out[key] = mix(from[key]!, to[key]!, u);
  return out as V;
};

// La foulée : jambes en ciseaux, balancier des bras, corps qui s'étire à chaque appui.
// `stride` avance de π par appui. Le corps reste droit : la course d'élan règle elle-même son inclinaison.
export const runPose = (stride: number): Pose => {
  const swing = Math.sin(stride);
  const lift = Math.cos(stride);
  return {
    rot: 0,
    flip: 1,
    sx: 1 - 0.04 * Math.abs(swing),
    sy: 1 + 0.05 * Math.abs(swing),
    lean: 4,
    head: -6,
    armA: -52 * swing,
    elbowA: 82,
    armB: 52 * swing,
    elbowB: 82,
    legA: 12 + 48 * swing,
    kneeA: 58 + 40 * lift,
    legB: 12 - 48 * swing,
    kneeB: 58 - 40 * lift,
  };
};

// De combien le bassin monte au-dessus de sa hauteur debout pendant la foulée.
export const runRise = (stride: number) => 8 + 18 * Math.abs(Math.sin(stride));
