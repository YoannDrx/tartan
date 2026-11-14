// Les gestes des exercices, par clé de catalogue. Un guide trouve le sien au moment de l'affichage :
// une séance publiée avant l'arrivée d'un geste le reçoit sans être republiée.
import type { ExerciseClip } from "../exercise";
import { FIRST } from "./first";
import { STRENGTH } from "./strength";
import { PLYOMETRICS } from "./plyometrics";
import { RUNNING } from "./running";
import { WEIGHTLIFTING } from "./weightlifting";

export const EXERCISE_CLIPS: Readonly<Record<string, ExerciseClip>> = Object.fromEntries(
  [...FIRST, ...STRENGTH, ...WEIGHTLIFTING, ...PLYOMETRICS, ...RUNNING].map((clip) => [clip.key, clip]),
);

export const exerciseClip = (catalogKey: string | null | undefined): ExerciseClip | null =>
  (catalogKey && EXERCISE_CLIPS[catalogKey]) || null;
