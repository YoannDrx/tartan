import { type BarRules, type BarState, bestOf, defineBarEvent } from "./bar-event";

// Saut à la perche, en concours : appuyer pour planter la perche, tenir pendant la flexion, relâcher au renversement.
// La barre part de 4,20 m et monte de 15 cm après chaque hauteur franchie (règle commune : bar-event.ts). Les temps
// suivent le geste de packages/mascot : le renversement tombe aux trois cinquièmes du vol.
//
// Un concours tient toujours dans les 90 s d'une partie : onze hauteurs, trois essais chacune, 270 pas par essai.

export { MAX_FAILS, OUTCOME, STAGE } from "./bar-event";
export type PoleVaultState = BarState;

export const TAKEOFF_TICK = 140;
export const FLIGHT_TICKS = 80;
export const ARCH_MIN_TICK = 32;
export const RELEASE_TICK = 48;
export const RESET_TICKS = 50;
export const TAKEOFF_WINDOW = { perfect: 3, good: 8, ok: 18 } as const;
export const RELEASE_WINDOW = { perfect: 4, good: 9, ok: 15 } as const;
export const FORM_SPAN = 50;
export const START_BAR = 4_200;
export const BAR_STEP = 150;

export const POLE_VAULT_RULES: BarRules = {
  id: "poleVault",
  takeoffTick: TAKEOFF_TICK,
  flightTicks: FLIGHT_TICKS,
  archMinTick: ARCH_MIN_TICK,
  releaseTick: RELEASE_TICK,
  resetTicks: RESET_TICKS,
  takeoffWindow: TAKEOFF_WINDOW,
  potential: { perfect: 5_800, good: 5_400, ok: 4_950 },
  releaseWindow: RELEASE_WINDOW,
  loss: { perfect: 0, good: 80, ok: 180 },
  formSpan: FORM_SPAN,
  startBar: START_BAR,
  barStep: BAR_STEP,
};

export const POLE_VAULT_BEST_MM = bestOf(POLE_VAULT_RULES);
export const poleVault = defineBarEvent(POLE_VAULT_RULES);
