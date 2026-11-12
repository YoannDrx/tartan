import { encodeLog, type Transition } from "../core/log";
import { BOARD_X, PHASE, type TripleJumpState, tripleJump } from "./triple-jump";

// Joueurs automatiques du triple saut, pour les tests et les parties de référence. Non exportés par le paquet.

export interface TriplePlan {
  readonly every: number;
  readonly aimAt: number;
  readonly hold: number;
  // Écart de l'appui à chaque réception, en pas (négatif : en avance). `null` : pas d'appui.
  readonly offsets: readonly [number | null, number | null];
}

// Joue le plan pas à pas, en appuyant au moment voulu de chaque réception, et rend le journal et l'état final.
export function playPlan(seed: number, plan: TriplePlan): { log: number[]; state: TripleJumpState } {
  const transitions: Transition[] = [];
  let state = tripleJump.init(seed);
  let held = 0;
  const set = (value: number) => {
    if (value === held) return;
    transitions.push({ tick: state.tick, channel: 0, press: value === 1 });
    held = value;
  };
  let releaseAt = -1;
  while (!state.finished) {
    if (state.phase === PHASE.run) {
      if (state.tick < plan.aimAt) set(state.tick % plan.every < 3 ? 1 : 0);
      else if (state.tick < plan.aimAt + plan.hold) set(state.tick === plan.aimAt && held === 1 ? 0 : 1);
      else set(0);
    } else if (state.phase === PHASE.hop || state.phase === PHASE.step) {
      const offset = plan.offsets[state.phase - 1];
      if (releaseAt === state.tick) set(0);
      if (offset !== null && offset !== undefined && state.air + 1 - state.flightTicks === offset && held === 0) {
        set(1);
        releaseAt = state.tick + 3;
      }
    } else if (releaseAt === state.tick) set(0);
    state = tripleJump.step(state, held);
  }
  return { log: encodeLog(transitions), state };
}

// Le dernier pas où commencer l'appel sans mordre.
export function boardPlan(seed: number, every: number, hold: number, offsets: TriplePlan["offsets"]): TriplePlan {
  let low = 0;
  let high = 2_000;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    const { state } = playPlan(seed, { every, aimAt: middle, hold, offsets });
    if (state.foul || state.takeoffX > BOARD_X) high = middle;
    else low = middle;
  }
  return { every, aimAt: low, hold, offsets };
}
