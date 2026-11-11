import { idiv } from "./int";

// Générateur de Park-Miller (« minimal standard ») : s' = 16807 × s mod (2^31 − 1).
// Écrit avec la décomposition de Schrage pour ne jamais sortir des entiers 32 bits.
// L'état est un simple entier : pas d'objet caché, la suite se rejoue à l'identique.
const MODULUS = 2_147_483_647;
const MULTIPLIER = 16_807;
const QUOTIENT = 127_773; // MODULUS div MULTIPLIER
const REMAINDER = 2_836; // MODULUS mod MULTIPLIER

// Ramène une graine 32 bits dans l'intervalle valide du générateur, [1, 2^31 − 2].
export const rngSeed = (seed: number): number => ((seed >>> 0) % (MODULUS - 1)) + 1;

export const rngNext = (state: number): number => {
  const high = idiv(state, QUOTIENT);
  const low = state - Math.imul(high, QUOTIENT);
  const next = Math.imul(MULTIPLIER, low) - Math.imul(REMAINDER, high);
  return next > 0 ? next : next + MODULUS;
};
