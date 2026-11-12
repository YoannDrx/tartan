import { type BarRules, type BarState, bestOf, defineBarEvent } from "./bar-event";

// Saut en hauteur, en concours : appuyer pour l'appel, tenir pour le cambré, relâcher pour dégager les jambes. La barre
// part de 1,60 m et monte de 5 cm après chaque hauteur franchie (règle commune : bar-event.ts).

export { MAX_FAILS, OUTCOME, STAGE } from "./bar-event";
export type HighJumpState = BarState;

export const TAKEOFF_TICK = 150;
export const FLIGHT_TICKS = 60;
export const ARCH_MIN_TICK = 20;
export const RELEASE_TICK = 38;
export const RESET_TICKS = 60;
export const TAKEOFF_WINDOW = { perfect: 3, good: 8, ok: 18 } as const;
export const RELEASE_WINDOW = { perfect: 3, good: 8, ok: 14 } as const;
export const FORM_SPAN = 20;
export const START_BAR = 1_600;
export const BAR_STEP = 50;

export const HIGH_JUMP_RULES: BarRules = {
  id: "highJump",
  takeoffTick: TAKEOFF_TICK,
  flightTicks: FLIGHT_TICKS,
  archMinTick: ARCH_MIN_TICK,
  releaseTick: RELEASE_TICK,
  resetTicks: RESET_TICKS,
  takeoffWindow: TAKEOFF_WINDOW,
  potential: { perfect: 2_050, good: 1_960, ok: 1_820 },
  releaseWindow: RELEASE_WINDOW,
  loss: { perfect: 0, good: 30, ok: 70 },
  formSpan: FORM_SPAN,
  startBar: START_BAR,
  barStep: BAR_STEP,
};

export const HIGH_JUMP_BEST_MM = bestOf(HIGH_JUMP_RULES);
export const highJump = defineBarEvent(HIGH_JUMP_RULES);
