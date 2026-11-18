// Les gestes écrits à la main, par clé de catalogue : les mêmes clés que le premier moteur (exercises/index.ts).
// Les autres gestes du catalogue sont relevés du premier moteur (registry.ts).
import type { MotionClip } from "../gesture";
import { backSquat } from "./back-squat";
import { clean } from "./clean";
import { cleanAndJerk } from "./clean-and-jerk";
import { lateralLunge } from "./lateral-lunge";
import { snatch } from "./snatch";

export const GESTURES: Readonly<Record<string, MotionClip>> = Object.fromEntries(
  [snatch, clean, cleanAndJerk, backSquat, lateralLunge].map((clip) => [clip.key, clip]),
);

export { backSquat, clean, cleanAndJerk, lateralLunge, snatch };
