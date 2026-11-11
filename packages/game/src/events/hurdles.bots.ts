import { encodeLog, type Transition } from "../core/log";
import { APEX_TICK, HURDLE_COUNT, type HurdlesState, hurdles } from "./hurdles";

// Joueurs automatiques, pour les tests et pour fabriquer les parties de référence.
// Ils ne sont pas exportés par le paquet.

// Pas où la prochaine haie sera atteinte si rien ne change. L'instant ne dépend pas des appuis :
// la vitesse évolue de la même façon au sol et en l'air jusqu'à la haie.
const crossingTick = (state: HurdlesState): number => {
  let probe = state;
  while (probe.next === state.next && !probe.finished) probe = hurdles.step(probe, 0);
  return probe.tick - 1;
};

// Joue une course en visant, pour chaque haie, un écart donné au sommet du saut (en pas).
// `null` : pas d'appui, la haie est percutée. Chaque appui est tenu `hold` pas.
export function scriptedLog(seed: number, offsets: readonly (number | null)[], hold = 8): number[] {
  const transitions: Transition[] = [];
  let state = hurdles.init(seed);
  let releaseAt = -1;
  let pressAt = -1;
  let planned = -1;
  while (!state.finished) {
    if (state.next < HURDLE_COUNT && planned !== state.next) {
      planned = state.next;
      const offset = offsets[state.next];
      // Franchir au pas de vol `APEX_TICK + offset` demande d'appuyer autant de pas avant la haie, moins un.
      pressAt = offset === null || offset === undefined ? -1 : crossingTick(state) - (APEX_TICK + offset) + 1;
    }
    let held = state.held;
    if (state.tick === releaseAt) {
      transitions.push({ tick: state.tick, channel: 0, press: false });
      held = 0;
    }
    if (state.tick === pressAt) {
      transitions.push({ tick: state.tick, channel: 0, press: true });
      held = 1;
      releaseAt = state.tick + hold;
    }
    state = hurdles.step(state, held);
  }
  return encodeLog(transitions);
}

export const perfectLog = (seed: number): number[] =>
  scriptedLog(
    seed,
    Array.from({ length: HURDLE_COUNT }, () => 0),
  );
