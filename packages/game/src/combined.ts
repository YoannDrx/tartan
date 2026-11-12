import { idiv } from "./core/int";
import type { EventId } from "./events";

// Le combiné : les six épreuves à la suite, chacune convertie en points par un barème propre au jeu, puis additionnées.
// Le barème est linéaire et entier : `zero` vaut 0 point, `full` vaut 1 000 ; on peut dépasser 1 000, jamais 1 200, et
// une marque nulle (essai mordu, aucune barre) vaut 0. Rien à voir avec les tables officielles : c'est un jeu.

export const COMBINED_ORDER = [
  "hurdles",
  "longJump",
  "tripleJump",
  "highJump",
  "poleVault",
  "discus",
] as const satisfies readonly EventId[];

// Pour chaque épreuve, la marque à 0 point et la marque à 1 000 points, dans l'unité de l'épreuve (ms ou mm).
export const SCALE: Record<(typeof COMBINED_ORDER)[number], { zero: number; full: number }> = {
  hurdles: { zero: 18_000, full: 13_000 },
  longJump: { zero: 3_000, full: 7_500 },
  tripleJump: { zero: 9_000, full: 15_000 },
  highJump: { zero: 1_500, full: 2_000 },
  poleVault: { zero: 4_000, full: 5_700 },
  discus: { zero: 15_000, full: 45_000 },
};
export const MAX_POINTS = 1_200;

export const pointsFor = (event: (typeof COMBINED_ORDER)[number], score: number): number => {
  if (score <= 0) return 0;
  const { zero, full } = SCALE[event];
  const points = idiv(Math.imul(score - zero, 1_000), full - zero);
  return points < 0 ? 0 : points > MAX_POINTS ? MAX_POINTS : points;
};

export const combinedTotal = (scores: readonly number[]): number =>
  COMBINED_ORDER.reduce((total, event, index) => total + pointsFor(event, scores[index] ?? 0), 0);
