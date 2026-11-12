import { encodeLog, type Transition } from "../core/log";
import { RELEASE_TICK, STAGE, TAKEOFF_TICK, type HighJumpState, highJump } from "./high-jump";

// Joueur automatique du saut en hauteur, pour les tests et les parties de référence. Non exporté par le paquet.
// Chaque essai suit un couple d'écarts (appel, jambes), en pas ; une fois la liste épuisée, le dernier couple sert.

export type Attempt = readonly [takeoff: number | null, release: number | null];

export function playAttempts(seed: number, attempts: readonly Attempt[]): { log: number[]; state: HighJumpState } {
  const transitions: Transition[] = [];
  let state = highJump.init(seed);
  let held = 0;
  const set = (value: number) => {
    if (value === held) return;
    transitions.push({ tick: state.tick, channel: 0, press: value === 1 });
    held = value;
  };
  while (!state.finished) {
    const [takeoff, release] = attempts[Math.min(state.attempts, attempts.length - 1)] ?? [0, 0];
    if (state.stage === STAGE.approach) {
      set(takeoff !== null && state.t + 1 - TAKEOFF_TICK === takeoff ? 1 : 0);
    } else if (state.stage === STAGE.flight) {
      set(release !== null && state.t + 1 - RELEASE_TICK === release ? 0 : held);
    } else set(0);
    state = highJump.step(state, held);
  }
  return { log: encodeLog(transitions), state };
}
