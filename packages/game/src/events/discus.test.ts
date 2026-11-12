import { describe, expect, it } from "vitest";
import { replay } from "../core/replay";
import { fuzzLog } from "../reference";
import { DISCUS_BEST_MM, MAX_ROTATION, MAX_SPIN, SECTOR_HALF, WAIT_LIMIT_TICKS, discus, throwOf } from "./discus";
import { playThrow } from "./discus.bots";

const play = (seed: number, plan: Parameters<typeof playThrow>[1]) => {
  const { log, state } = playThrow(seed, plan);
  const result = replay(discus, seed, log);
  if (!result.ok) throw new Error(result.error);
  expect(result.state).toEqual(state);
  return result;
};

describe("disque : la volte et le lâcher", () => {
  it("plus la volte est longue, plus la rotation est rapide, et plus le disque part loin", () => {
    const first = play(5, { turn: 1 }).score;
    const second = play(5, { turn: 2 }).score;
    expect(second).toBeGreaterThan(first);
    expect(second).toBeGreaterThan(40_000);
    expect(second).toBeLessThanOrEqual(DISCUS_BEST_MM);
  });

  it("lâcher hors du secteur est mordu", () => {
    const result = play(5, { turn: 2, offset: 12 });
    expect(result.score).toBe(0);
    expect(result.state).toMatchObject({ foul: true });
    expect(Math.abs((result.state as { direction: number }).direction)).toBeGreaterThan(SECTOR_HALF);
  });

  it("au-delà de trois tours, le lanceur sort du cercle ; sans volte, l'essai est perdu", () => {
    const over = play(5, { turn: null });
    expect(over.state).toMatchObject({ overturned: true, score: 0 });
    expect((over.state as { rotation: number }).rotation).toBeGreaterThan(MAX_ROTATION);
    expect(play(5, { start: WAIT_LIMIT_TICKS + 10, turn: 1 }).ticks).toBe(WAIT_LIMIT_TICKS);
  });

  it("la vitesse du disque suit la rotation", () => {
    expect(throwOf(MAX_SPIN).distance).toBeGreaterThan(throwOf(MAX_SPIN >> 1).distance);
  });
});

describe("disque : plafond théorique", () => {
  it("n'est battu par aucune partie", () => {
    expect(DISCUS_BEST_MM).toBe(47_099);
    for (let seed = 1; seed <= 60; seed += 1)
      for (const turn of [1, 2, 3]) expect(play(seed, { turn }).score).toBeLessThanOrEqual(DISCUS_BEST_MM);
    for (let seed = 1; seed <= 300; seed += 1) {
      const result = replay(discus, seed, fuzzLog(seed));
      if (result.ok) expect(result.score).toBeLessThanOrEqual(DISCUS_BEST_MM);
    }
  });
});
