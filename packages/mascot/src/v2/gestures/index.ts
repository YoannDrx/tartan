// Les gestes écrits à la main, par clé de catalogue : les mêmes clés que le premier moteur (exercises/index.ts).
// Les autres gestes du catalogue sont relevés du premier moteur (registry.ts).
import type { MotionClip } from "../gesture";
import { backSquat } from "./back-squat";
import { clean } from "./clean";
import { cleanAndJerk } from "./clean-and-jerk";
import { jerkDipDrill, pushJerk, pushPress, splitJerk } from "./jerk";
import { lateralLunge } from "./lateral-lunge";
import { overheadSquat, snatchBalance } from "./overhead";
import { cleanPull, snatchDeadlift, snatchPull } from "./pulls";
import { snatch } from "./snatch";
import {
  hangClean,
  hangPowerClean,
  hangPowerSnatch,
  hangSnatch,
  muscleSnatch,
  powerClean,
  powerSnatch,
  tallClean,
} from "./variants";

// Haltérophilie : les vingt gestes du catalogue.
export const WEIGHTLIFTING_GESTURES: readonly MotionClip[] = [
  snatch,
  clean,
  cleanAndJerk,
  splitJerk,
  pushJerk,
  pushPress,
  jerkDipDrill,
  powerSnatch,
  powerClean,
  hangSnatch,
  hangClean,
  hangPowerSnatch,
  hangPowerClean,
  muscleSnatch,
  tallClean,
  snatchPull,
  cleanPull,
  snatchDeadlift,
  overheadSquat,
  snatchBalance,
];
// Musculation.
export const STRENGTH_GESTURES: readonly MotionClip[] = [backSquat, lateralLunge];

export const GESTURES: Readonly<Record<string, MotionClip>> = Object.fromEntries(
  [...WEIGHTLIFTING_GESTURES, ...STRENGTH_GESTURES].map((clip) => [clip.key, clip]),
);

export {
  backSquat,
  clean,
  cleanAndJerk,
  cleanPull,
  hangClean,
  hangPowerClean,
  hangPowerSnatch,
  hangSnatch,
  jerkDipDrill,
  lateralLunge,
  muscleSnatch,
  overheadSquat,
  powerClean,
  powerSnatch,
  pushJerk,
  pushPress,
  snatch,
  snatchBalance,
  snatchDeadlift,
  snatchPull,
  splitJerk,
  tallClean,
};
