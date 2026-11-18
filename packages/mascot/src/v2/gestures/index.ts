// Les gestes écrits à la main, par clé de catalogue : les mêmes clés que le premier moteur (exercises/index.ts).
// Les autres gestes du catalogue sont relevés du premier moteur (registry.ts).
import type { MotionClip } from "../gesture";
import { backSquat } from "./back-squat";
import { clean } from "./clean";
import { chinUp, parallelBarDips, pullUp, pushUp } from "./bodyweight";
import { cleanAndJerk } from "./clean-and-jerk";
import { barbellRow, deadlift, goodMorning, romanianDeadlift, sumoDeadlift } from "./hinges";
import { jerkDipDrill, pushJerk, pushPress, splitJerk } from "./jerk";
import { lateralLunge } from "./lateral-lunge";
import { forwardLunge, reverseLunge } from "./lunges";
import { overheadSquat, snatchBalance } from "./overhead";
import { hipThrust } from "./hip-thrust";
import { benchPress, overheadPress } from "./presses";
import { cleanPull, snatchDeadlift, snatchPull } from "./pulls";
import { snatch } from "./snatch";
import { bulgarianSquat, frontSquat } from "./squats";
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
export const STRENGTH_GESTURES: readonly MotionClip[] = [
  backSquat,
  lateralLunge,
  pullUp,
  chinUp,
  parallelBarDips,
  pushUp,
  deadlift,
  romanianDeadlift,
  sumoDeadlift,
  goodMorning,
  barbellRow,
  frontSquat,
  bulgarianSquat,
  benchPress,
  overheadPress,
  hipThrust,
  forwardLunge,
  reverseLunge,
];

export const GESTURES: Readonly<Record<string, MotionClip>> = Object.fromEntries(
  [...WEIGHTLIFTING_GESTURES, ...STRENGTH_GESTURES].map((clip) => [clip.key, clip]),
);

export {
  barbellRow,
  benchPress,
  bulgarianSquat,
  chinUp,
  deadlift,
  forwardLunge,
  frontSquat,
  goodMorning,
  hipThrust,
  overheadPress,
  parallelBarDips,
  pullUp,
  pushUp,
  reverseLunge,
  romanianDeadlift,
  sumoDeadlift,
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
