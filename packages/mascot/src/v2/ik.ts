// Cinématique inverse à deux os, analytique : une épaule et une main donnent le coude, une hanche et une cheville
// donnent le genou. Le vecteur de pôle dit de quel côté l'articulation du milieu se plie.
import { add, cross, dot, length, normalize, scale, sub, vec, type Vec3 } from "./vec";

// La distance entre les deux bouts d'une chaîne pliée de `flexion` degrés (0 : tendue).
export const span = (first: number, second: number, flexion: number) =>
  Math.sqrt(first * first + second * second + 2 * first * second * Math.cos((flexion * Math.PI) / 180));

export type TwoBone = {
  // L'articulation du milieu, et le bout réellement atteint : la cible, sauf si elle est hors de portée.
  mid: Vec3;
  end: Vec3;
  // La flexion de l'articulation du milieu, en degrés : 0 pour un membre tendu.
  flexion: number;
};

// `slack` : la flexion minimale gardée, en degrés, pour qu'un membre tendu ne se verrouille jamais à l'envers.
export const twoBone = (root: Vec3, target: Vec3, first: number, second: number, pole: Vec3, slack = 1): TwoBone => {
  const reach = sub(target, root);
  const far = span(first, second, slack);
  const near = Math.abs(first - second) + 1e-3;
  const wanted = length(reach);
  const size = Math.min(far, Math.max(near, wanted));
  const axis = wanted < 1e-9 ? vec(0, -1, 0) : scale(reach, 1 / wanted);
  // Le côté du pli : le pôle, sans sa part le long de l'axe. Un pôle aligné sur l'axe prend une perpendiculaire.
  let side = sub(pole, scale(axis, dot(pole, axis)));
  if (length(side) < 1e-6) side = cross(axis, Math.abs(axis.x) < 0.9 ? vec(1, 0, 0) : vec(0, 1, 0));
  side = normalize(side);
  const base = (size * size + first * first - second * second) / (2 * size);
  const height = Math.sqrt(Math.max(0, first * first - base * base));
  const cosine = (size * size - first * first - second * second) / (2 * first * second);
  return {
    mid: add(root, add(scale(axis, base), scale(side, height))),
    end: add(root, scale(axis, size)),
    flexion: (Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI,
  };
};

// De combien monter ou descendre `from`, le long de la verticale, pour qu'il soit à `reach` de `to`.
// Deux hauteurs conviennent : celle qui garde `from` du même côté de `to`. `null` si aucune ne convient.
export const liftToReach = (from: Vec3, to: Vec3, reach: number): number | null => {
  const gap = sub(from, to);
  const flat = gap.x * gap.x + gap.z * gap.z;
  if (flat > reach * reach) return null;
  const rise = Math.sqrt(reach * reach - flat);
  return (gap.y >= 0 ? rise : -rise) - gap.y;
};
