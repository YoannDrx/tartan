// Les gestes du prototype, par clé de catalogue : les mêmes clés que le premier moteur (exercises/index.ts).
import type { MotionClip } from "../gesture";
import { backSquat } from "./back-squat";
import { lateralLunge } from "./lateral-lunge";
import { snatch } from "./snatch";

export const GESTURES: Readonly<Record<string, MotionClip>> = Object.fromEntries(
  [snatch, backSquat, lateralLunge].map((clip) => [clip.key, clip]),
);

export { backSquat, lateralLunge, snatch };
