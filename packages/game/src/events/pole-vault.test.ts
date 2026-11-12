import { describe, expect, it } from "vitest";
import { MAX_TICKS } from "../core/constants";
import { replay } from "../core/replay";
import { fuzzLog } from "../reference";
import { type Attempt, playAttempts } from "./bar.bots";
import {
  BAR_STEP,
  MAX_FAILS,
  POLE_VAULT_BEST_MM,
  RELEASE_TICK,
  RELEASE_WINDOW,
  START_BAR,
  TAKEOFF_TICK,
  poleVault,
} from "./pole-vault";

const times = { takeoff: TAKEOFF_TICK, release: RELEASE_TICK };
const play = (seed: number, attempts: Parameters<typeof playAttempts>[1]) => {
  const { log, state } = playAttempts(seed, attempts, poleVault, times);
  const result = replay(poleVault, seed, log);
  if (!result.ok) throw new Error(result.error);
  expect(result.state).toEqual(state);
  return result;
};

describe("saut à la perche : le concours", () => {
  it("des sauts parfaits montent la barre de 15 cm en 15 cm, jusqu'à 5,70 m environ", () => {
    const result = play(7, [[0, 0]]);
    expect(result.score).toBeGreaterThanOrEqual(5_550);
    expect(result.score).toBeLessThanOrEqual(POLE_VAULT_BEST_MM);
    expect((result.score - START_BAR) % BAR_STEP).toBe(0);
  });

  it("un renversement moins juste fait perdre de la hauteur", () => {
    expect(play(11, [[0, 0]]).score).toBeGreaterThan(play(11, [[0, RELEASE_WINDOW.ok]]).score);
  });

  it("même deux échecs à chaque hauteur, le concours tient dans une partie", () => {
    const attempts: Attempt[] = Array.from({ length: 60 }, (_, index) => (index % 3 === 2 ? [0, 0] : [null, null]));
    const result = play(3, attempts);
    expect(result.ticks).toBeLessThan(MAX_TICKS);
    expect(result.state).toMatchObject({ fails: MAX_FAILS });
  });
});

describe("saut à la perche : plafond théorique", () => {
  it("n'est battu par aucune partie", () => {
    expect(POLE_VAULT_BEST_MM).toBe(5_850);
    for (let seed = 1; seed <= 40; seed += 1)
      expect(play(seed, [[0, 0]]).score).toBeLessThanOrEqual(POLE_VAULT_BEST_MM);
    for (let seed = 1; seed <= 300; seed += 1) {
      const result = replay(poleVault, seed, fuzzLog(seed));
      if (result.ok) expect(result.score).toBeLessThanOrEqual(POLE_VAULT_BEST_MM);
    }
  });
});
