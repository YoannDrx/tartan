import { describe, expect, it } from "vitest";
import { replay } from "../core/replay";
import { fuzzLog } from "../reference";
import {
  ARCH_MIN_TICK,
  BAR_STEP,
  HIGH_JUMP_BEST_MM,
  MAX_FAILS,
  OUTCOME,
  RELEASE_TICK,
  RELEASE_WINDOW,
  START_BAR,
  TAKEOFF_WINDOW,
  highJump,
} from "./high-jump";
import { playAttempts } from "./bar.bots";

const play = (seed: number, attempts: Parameters<typeof playAttempts>[1]) => {
  const { log, state } = playAttempts(seed, attempts);
  const result = replay(highJump, seed, log);
  if (!result.ok) throw new Error(result.error);
  expect(result.state).toEqual(state);
  return result;
};

describe("saut en hauteur : le concours", () => {
  it("des sauts parfaits passent la barre de 5 cm en 5 cm, jusqu'à 2,05 m environ", () => {
    const result = play(7, [[0, 0]]);
    expect(result.score).toBeGreaterThanOrEqual(2_000);
    expect(result.score).toBeLessThanOrEqual(HIGH_JUMP_BEST_MM);
    expect((result.score - START_BAR) % BAR_STEP).toBe(0);
  });

  it("trois échecs de suite à la même hauteur arrêtent le concours ; sans barre franchie, la marque est nulle", () => {
    const result = play(7, [[null, null]]);
    expect(result.score).toBe(0);
    expect(result.state).toMatchObject({ attempts: MAX_FAILS, fails: MAX_FAILS, outcome: OUTCOME.balked });
  });

  it("un échec ne fait pas monter la barre ; un franchissement la monte", () => {
    const result = play(7, [
      [0, 0],
      [null, null],
      [0, 0],
      [null, null],
      [null, null],
      [null, null],
    ]);
    expect(result.score).toBe(START_BAR + BAR_STEP);
  });

  it("un appel moins juste, ou des jambes dégagées trop tard, font perdre de la hauteur", () => {
    const perfect = play(11, [[0, 0]]).score;
    const looseTakeoff = play(11, [[TAKEOFF_WINDOW.ok, 0]]).score;
    const lateLegs = play(11, [[0, RELEASE_WINDOW.ok]]).score;
    expect(perfect).toBeGreaterThan(looseTakeoff);
    expect(perfect).toBeGreaterThan(lateLegs);
  });

  it("lâcher avant d'avoir passé les hanches, ou trop tard, fait tomber la barre", () => {
    for (const release of [ARCH_MIN_TICK - RELEASE_TICK - 1, RELEASE_WINDOW.ok + 1]) {
      const result = play(11, [[0, release]]);
      expect(result.score).toBe(0);
      expect(result.state).toMatchObject({ outcome: OUTCOME.failed });
    }
  });
});

describe("saut en hauteur : plafond théorique", () => {
  it("vaut la meilleure forme avec appel et jambes parfaits, ramenée à la barre", () => {
    expect(HIGH_JUMP_BEST_MM).toBe(2_050);
    for (let seed = 1; seed <= 60; seed += 1) expect(play(seed, [[0, 0]]).score).toBeLessThanOrEqual(HIGH_JUMP_BEST_MM);
    for (let seed = 1; seed <= 300; seed += 1) {
      const result = replay(highJump, seed, fuzzLog(seed));
      if (result.ok) expect(result.score).toBeLessThanOrEqual(HIGH_JUMP_BEST_MM);
    }
  });
});
