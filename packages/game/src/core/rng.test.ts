import { describe, expect, it } from "vitest";
import { rngNext, rngSeed } from "./rng";

describe("générateur de Park-Miller", () => {
  it("donne la valeur de contrôle publiée : 1 043 618 065 au 10 000e tirage depuis 1", () => {
    let state = 1;
    for (let index = 0; index < 10_000; index += 1) state = rngNext(state);
    expect(state).toBe(1_043_618_065);
  });

  it("reste dans l'intervalle valide, sans jamais tomber sur zéro", () => {
    let state = rngSeed(0xffff_ffff);
    for (let index = 0; index < 5_000; index += 1) {
      state = rngNext(state);
      expect(state).toBeGreaterThan(0);
      expect(state).toBeLessThan(2_147_483_647);
    }
  });

  it("ramène toute graine 32 bits à un état de départ valide", () => {
    for (const seed of [0, 1, 2_147_483_645, 2_147_483_646, 2_147_483_647, 0xffff_ffff]) {
      const state = rngSeed(seed);
      expect(state).toBeGreaterThanOrEqual(1);
      expect(state).toBeLessThanOrEqual(2_147_483_646);
    }
  });
});
