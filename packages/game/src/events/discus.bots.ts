import { encodeLog, type Transition } from "../core/log";
import { PHASE, type DiscusState, directionOf, discus } from "./discus";

// Joueur automatique du disque, pour les tests et les parties de référence. Non exporté par le paquet.
// Il tient l'appui et lâche au `turn`-ième passage du bras devant le centre du secteur, décalé de `offset` pas.

export function playThrow(
  seed: number,
  plan: { start?: number; turn: number | null; offset?: number },
): { log: number[]; state: DiscusState } {
  const transitions: Transition[] = [];
  let state = discus.init(seed);
  let held = 0;
  let passes = 0;
  let releaseAt = -1;
  const set = (value: number) => {
    if (value === held) return;
    transitions.push({ tick: state.tick, channel: 0, press: value === 1 });
    held = value;
  };
  while (!state.finished) {
    if (state.phase === PHASE.waiting) set(state.tick >= (plan.start ?? 30) ? 1 : 0);
    else if (state.phase === PHASE.spinning) {
      // Où sera le bras après ce pas : on compte ses passages devant le centre du secteur.
      const before = directionOf(state.angle);
      const after = directionOf(state.angle + state.spin);
      if (before < 0 && after >= 0) {
        passes += 1;
        if (plan.turn !== null && passes === plan.turn) releaseAt = state.tick + (plan.offset ?? 0);
      }
      if (state.tick === releaseAt) set(0);
    } else set(0);
    state = discus.step(state, held);
  }
  return { log: encodeLog(transitions), state };
}
