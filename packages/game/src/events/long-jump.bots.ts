import { encodeLog, type Transition } from "../core/log";
import { BOARD_X, type LongJumpState, longJump } from "./long-jump";

// Joueurs automatiques du saut en longueur, pour les tests et les parties de référence. Non exportés par le paquet.

export interface JumpPlan {
  // Un appui bref tous les `every` pas, tenu `tap` pas.
  readonly every: number;
  readonly tap?: number;
  // Le pas où commence l'appel, et combien de pas il est tenu.
  readonly aimAt: number;
  readonly hold: number;
}

export function planLog(plan: JumpPlan): number[] {
  const tap = plan.tap ?? 3;
  const transitions: Transition[] = [];
  for (let tick = 0; tick + tap < plan.aimAt; tick += plan.every) {
    transitions.push({ tick, channel: 0, press: true }, { tick: tick + tap, channel: 0, press: false });
  }
  const start = transitions.length ? Math.max(plan.aimAt, transitions[transitions.length - 1]!.tick + 1) : plan.aimAt;
  transitions.push({ tick: start, channel: 0, press: true }, { tick: start + plan.hold, channel: 0, press: false });
  return encodeLog(transitions);
}

// Joue un journal pas à pas, et ignore ce qui suit la fin de l'essai (le rejeu, lui, le refuse).
export const playLog = (seed: number, log: readonly number[]): LongJumpState => {
  let state = longJump.init(seed);
  let held = 0;
  let tick = 0;
  let index = 0;
  const changes = log.map((entry) => ((tick += entry >>> 2), { tick, press: (entry & 1) === 1 }));
  while (!state.finished) {
    while (index < changes.length && changes[index]!.tick === state.tick) held = changes[index++]!.press ? 1 : 0;
    state = longJump.step(state, held);
  }
  return state;
};

// Le dernier pas où l'on peut commencer l'appel sans mordre : la planche prise au plus près.
export function boardPlan(seed: number, every: number, hold: number): JumpPlan {
  let low = 0;
  let high = 2_000;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    const state = playLog(seed, planLog({ every, aimAt: middle, hold }));
    if (state.foul || state.takeoffX > BOARD_X) high = middle;
    else low = middle;
  }
  return { every, aimAt: low, hold };
}
