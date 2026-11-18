// Les gestes écrits à la main, par clé de catalogue : les mêmes clés que le premier moteur (exercises/index.ts).
// Les autres gestes du catalogue sont relevés du premier moteur (registry.ts).
import type { MotionClip } from "../gesture";
import { backSquat } from "./back-squat";
import { hipCar, legSwings } from "./balance";
import { clean } from "./clean";
import { chinUp, inclinePushUp, invertedRow, parallelBarDips, pullUp, pushUp } from "./bodyweight";
import { cleanAndJerk } from "./clean-and-jerk";
import { barbellRow, deadlift, goodMorning, romanianDeadlift, sumoDeadlift } from "./hinges";
import { jerkDipDrill, pushJerk, pushPress, splitJerk } from "./jerk";
import { lateralLunge } from "./lateral-lunge";
import { forwardLunge, reverseLunge } from "./lunges";
import { overheadSquat, snatchBalance } from "./overhead";
import { hipThrust } from "./hip-thrust";
import { benchPress, overheadPress } from "./presses";
import { cleanPull, snatchDeadlift, snatchPull } from "./pulls";
import { sidePlank } from "./side-plank";
import { adductorRockback, cossackMobility, hip9090, proneHipRotation, toeExtensionRock } from "./mobility";
import { snatch } from "./snatch";
import { carioca, crossStepStairs } from "./stepping";
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
  inclinePushUp,
  invertedRow,
];

// Les autres familles : pliométrie, gainage, coordination, escaliers, échauffement, mobilité, course.
export const OTHER_GESTURES: readonly MotionClip[] = [
  legSwings,
  hipCar,
  sidePlank,
  carioca,
  crossStepStairs,
  cossackMobility,
  adductorRockback,
  toeExtensionRock,
  proneHipRotation,
  hip9090,
];

export const GESTURES: Readonly<Record<string, MotionClip>> = Object.fromEntries(
  [...WEIGHTLIFTING_GESTURES, ...STRENGTH_GESTURES, ...OTHER_GESTURES].map((clip) => [clip.key, clip]),
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
  inclinePushUp,
  invertedRow,
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
