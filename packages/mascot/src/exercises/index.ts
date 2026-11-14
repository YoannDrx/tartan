// Les gestes des exercices, par clé de catalogue. Un guide trouve le sien au moment de l'affichage :
// une séance publiée avant l'arrivée d'un geste le reçoit sans être republiée.
import type { ExerciseClip } from "../exercise";
import { CORE } from "./core";
import { DRILLS } from "./drills";
import { MOBILITY } from "./mobility";
import { PLYOMETRICS } from "./plyometrics";
import { RUNNING } from "./running";
import { STRENGTH } from "./strength";
import { WEIGHTLIFTING } from "./weightlifting";

export const EXERCISE_CLIPS: Readonly<Record<string, ExerciseClip>> = Object.fromEntries(
  [...STRENGTH, ...WEIGHTLIFTING, ...PLYOMETRICS, ...RUNNING, ...CORE, ...DRILLS, ...MOBILITY].map((clip) => [clip.key, clip]),
);

export const exerciseClip = (catalogKey: string | null | undefined): ExerciseClip | null =>
  (catalogKey && EXERCISE_CLIPS[catalogKey]) || null;
