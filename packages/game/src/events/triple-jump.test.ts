import { describe, expect, it } from "vitest";
import { replay } from "../core/replay";
import { fuzzLog } from "../reference";
import { MAX_WIND } from "./long-jump";
import { GRADE, OK_WINDOW, PIT_START_MM, TRIPLE_JUMP_BEST_MM, markOf, tripleJump, windOf } from "./triple-jump";
import { boardPlan, playPlan } from "./triple-jump.bots";

const seedWithWind = (wind: number): number => {
  for (let seed = 0; seed < 100_000; seed += 1) if (windOf(seed) === wind) return seed;
  throw new Error(`aucune graine pour le vent ${wind}`);
};
const CALM = seedWithWind(0);
const TAILWIND = seedWithWind(MAX_WIND);

const play = (seed: number, every: number, hold: number, offsets: [number | null, number | null]) => {
  const { log, state } = playPlan(seed, boardPlan(seed, every, hold, offsets));
  const result = replay(tripleJump, seed, log);
  if (!result.ok) throw new Error(result.error);
  expect(result.state).toEqual(state);
  return result;
};

describe("triple saut : le rythme", () => {
  it("deux réceptions parfaites, huit appuis par seconde : entre 11 et 13 m", () => {
    const result = play(CALM, 15, 40, [0, 0]);
    expect(result.score).toBeGreaterThan(11_000);
    expect(result.score).toBeLessThan(13_000);
    expect(result.state).toMatchObject({ grades: [GRADE.perfect, GRADE.perfect], broken: false });
    expect(result.score).toBe(markOf(result.state as never));
  });

  it("chaque pas d'écart à la réception coûte de l'élan, donc de la distance", () => {
    const perfect = play(CALM, 15, 40, [0, 0]).score;
    const good = play(CALM, 15, 40, [5, -5]).score;
    const late = play(CALM, 15, 40, [10, 10]).score;
    expect(perfect).toBeGreaterThan(good);
    expect(good).toBeGreaterThan(late);
  });

  it("un appui trop tôt, trop tard ou absent casse le rythme : l'essai ne compte pas", () => {
    for (const offsets of [
      [-(OK_WINDOW + 1), 0],
      [0, OK_WINDOW + 1],
      [null, 0],
      [0, null],
    ] as const) {
      const { state } = playPlan(CALM, boardPlan(CALM, 15, 40, [0, 0]));
      expect(state.broken).toBe(false);
      const broken = playPlan(CALM, { ...boardPlan(CALM, 15, 40, [0, 0]), offsets: [...offsets] as never });
      expect(broken.state).toMatchObject({ broken: true, score: 0 });
    }
  });

  it("un appel au-delà de la planche est mordu ; un élan trop lent retombe avant le sable", () => {
    const plan = boardPlan(CALM, 15, 40, [0, 0]);
    expect(playPlan(CALM, { ...plan, aimAt: plan.aimAt + 1 }).state).toMatchObject({ foul: true, score: 0 });
    const slow = playPlan(CALM, boardPlan(CALM, 40, 40, [0, 0])).state;
    expect(slow).toMatchObject({ short: true, score: 0 });
    expect(markOf(slow)).toBeLessThan(PIT_START_MM);
  });
});

describe("triple saut : plafond théorique", () => {
  it("n'est battu par aucun plan, ni par aucun journal pseudo-aléatoire", () => {
    expect(TRIPLE_JUMP_BEST_MM).toBe(15_596);
    for (const every of [4, 8, 12, 15]) {
      for (const hold of [20, 40, 48]) {
        const { state } = playPlan(TAILWIND, boardPlan(TAILWIND, every, hold, [0, 0]));
        expect(state.score ?? 0).toBeLessThanOrEqual(TRIPLE_JUMP_BEST_MM);
      }
    }
    for (let seed = 1; seed <= 300; seed += 1) {
      const result = replay(tripleJump, TAILWIND, fuzzLog(seed));
      if (result.ok) expect(result.score).toBeLessThanOrEqual(TRIPLE_JUMP_BEST_MM);
    }
  });
});
