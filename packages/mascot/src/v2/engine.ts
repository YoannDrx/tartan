// Quel moteur anime une fiche. Le nouveau moteur prend un geste dès qu'il est écrit à la main, ou relevé sans
// contrainte violée. Les gestes à reprendre gardent le premier moteur tant qu'ils ne sont pas réécrits : un geste
// faux dans le nouveau corps ne remplace pas un geste connu.
import { MOTION_BATCHES } from "../exercise";
import { EXERCISE_CLIPS } from "../exercises";
import { A_REPRENDRE, type Constraint } from "./a-reprendre";
import { GESTURES } from "./gestures";

export type MotionEngine = "v1" | "v2";

export const motionEngine = (catalogKey: string | null | undefined): MotionEngine | null => {
  if (!catalogKey || !EXERCISE_CLIPS[catalogKey]) return null;
  if (GESTURES[catalogKey]) return "v2";
  return catalogKey in A_REPRENDRE ? "v1" : "v2";
};

// Où en est un geste : écrit à la main, relevé du premier moteur, ou relevé mais à reprendre.
export const MOTION_LEVELS = ["ecrit", "releve", "a-reprendre"] as const;
export type MotionLevel = (typeof MOTION_LEVELS)[number];

export const motionLevel = (catalogKey: string | null | undefined): MotionLevel | null => {
  if (!catalogKey || !EXERCISE_CLIPS[catalogKey]) return null;
  if (GESTURES[catalogKey]) return "ecrit";
  return catalogKey in A_REPRENDRE ? "a-reprendre" : "releve";
};

// Ce qu'un geste à reprendre ne respecte pas encore.
export const brokenConstraints = (catalogKey: string): readonly Constraint[] => A_REPRENDRE[catalogKey] ?? [];

// Les séries de relecture du fondateur. Un geste du nouveau moteur est une nouvelle série : une famille validée
// avant lui ne le couvre pas. Un geste resté sur le premier moteur garde sa série d'origine.
export const REVIEW_BATCHES = [...MOTION_BATCHES, "v2"] as const;
export type ReviewBatch = (typeof REVIEW_BATCHES)[number];

export const reviewBatch = (catalogKey: string | null | undefined): ReviewBatch | undefined =>
  motionEngine(catalogKey) === "v2" ? "v2" : catalogKey ? EXERCISE_CLIPS[catalogKey]?.batch : undefined;
