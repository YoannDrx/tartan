// Quel moteur anime une fiche. Il n'en reste qu'un depuis que les derniers gestes à reprendre sont écrits à la
// main : toute fiche qui a un geste le joue avec le corps en trois dimensions. La fonction reste exportée pour
// l'app native, qui la consulte encore avant d'afficher un guide ; le web n'en a plus besoin.
import { EXERCISE_CLIPS } from "../exercises";
import { GESTURES } from "./gestures";

export type MotionEngine = "v2";

export const motionEngine = (catalogKey: string | null | undefined): MotionEngine | null =>
  catalogKey && (GESTURES[catalogKey] || EXERCISE_CLIPS[catalogKey]) ? "v2" : null;

// Où en est un geste : écrit à la main, ou relevé du premier moteur (ses angles, rejoués par le nouveau corps).
export const MOTION_LEVELS = ["ecrit", "releve"] as const;
export type MotionLevel = (typeof MOTION_LEVELS)[number];

export const motionLevel = (catalogKey: string | null | undefined): MotionLevel | null => {
  if (!catalogKey || !motionEngine(catalogKey)) return null;
  return GESTURES[catalogKey] ? "ecrit" : "releve";
};
