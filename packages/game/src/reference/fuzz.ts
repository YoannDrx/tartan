import { encodeEntry } from "../core/log";
import { replay } from "../core/replay";
import { rngNext, rngSeed } from "../core/rng";
import type { GameEvent, SimState } from "../core/sim";

// Journaux pseudo-aléatoires, toujours bien formés, tirés d'une graine : de quoi comparer deux
// moteurs sur des centaines de parties sans les stocker. Certains débordent la fin de la course
// et sont donc refusés : le refus fait partie de ce qui doit être identique partout.
export function fuzzLog(seed: number, channels: 1 | 2 = 1): number[] {
  let state = rngSeed(seed);
  const draw = (bound: number): number => {
    state = rngNext(state);
    return state % bound;
  };
  const count = 16 + draw(32);
  const log: number[] = [];
  let held = 0;
  for (let index = 0; index < count; index += 1) {
    const delta = 1 + draw(90);
    const bit = 1 << draw(channels);
    log.push(encodeEntry(delta, bit >> 1, (held & bit) === 0));
    held ^= bit;
  }
  return log;
}

// Résumé, en un seul entier, des relectures de `count` journaux tirés des graines `from` et suivantes.
export function fuzzSummary<S extends SimState>(event: GameEvent<S>, from: number, count: number): number {
  let hash = 0;
  const mix = (value: number): void => {
    hash = Math.imul(hash ^ value, 16_777_619);
    hash ^= hash >>> 13;
  };
  for (let seed = from; seed < from + count; seed += 1) {
    const result = replay(event, seed, fuzzLog(seed, event.channels));
    if (result.ok) {
      mix(result.score);
      mix(result.ticks);
      mix(result.digest | 0);
    } else {
      mix(-2 - result.index);
    }
  }
  return hash >>> 0;
}
