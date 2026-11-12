import { describe, expect, it } from "vitest";
import { replay } from "../core/replay";
import { fuzzLog } from "../reference";
import {
  BOARD_X,
  LONG_JUMP_BEST_MM,
  MAX_SPEED,
  MAX_WIND,
  RUN_LIMIT_TICKS,
  TAP_MAX,
  angleOf,
  flightOf,
  longJump,
  markOf,
  phaseOf,
  toMillimetres,
  windOf,
} from "./long-jump";
import { boardPlan, planLog, playLog } from "./long-jump.bots";

const seedWithWind = (wind: number): number => {
  for (let seed = 0; seed < 100_000; seed += 1) if (windOf(seed) === wind) return seed;
  throw new Error(`aucune graine pour le vent ${wind}`);
};
const CALM = seedWithWind(0);
const TAILWIND = seedWithWind(MAX_WIND);

const jump = (seed: number, log: readonly number[]) => {
  const result = replay(longJump, seed, log);
  if (!result.ok) throw new Error(result.error);
  return result;
};

describe("saut en longueur : l'élan", () => {
  it("place la planche à 40 m, et tire de la graine un vent entre −2,0 et +2,0 m/s", () => {
    expect(toMillimetres(BOARD_X)).toBe(40_000);
    for (let seed = 0; seed < 500; seed += 1) {
      expect(Math.abs(windOf(seed))).toBeLessThanOrEqual(MAX_WIND);
      expect(longJump.init(seed).wind).toBe(windOf(seed));
    }
  });

  it("des appuis rapides donnent plus d'élan que des appuis lents, sans dépasser la vitesse maximale", () => {
    const speedAfter = (every: number) => {
      let state = longJump.init(CALM);
      for (let tick = 0; tick < 360; tick += 1) state = longJump.step(state, tick % every < 3 ? 1 : 0);
      return state.v;
    };
    expect(speedAfter(12)).toBeGreaterThan(speedAfter(24));
    expect(speedAfter(4)).toBeLessThanOrEqual(MAX_SPEED);
  });

  it("un appui bref ne fait pas sauter ; tenu plus de 10 pas, son relâchement est l'appel", () => {
    let state = longJump.init(CALM);
    for (let tick = 0; tick < TAP_MAX; tick += 1) state = longJump.step(state, 1);
    state = longJump.step(state, 0);
    expect(state.takeoffX).toBe(-1);
    for (let tick = 0; tick <= TAP_MAX + 20; tick += 1) state = longJump.step(state, 1);
    expect(phaseOf(state)).toBe("aim");
    state = longJump.step(state, 0);
    expect(phaseOf(state)).toBe("flight");
    expect(state.angle).toBe(angleOf(TAP_MAX + 21));
  });

  it("sans appel, l'essai est perdu au bout de 20 s, ou dès qu'on court au-delà de la planche", () => {
    expect(jump(CALM, [])).toMatchObject({ score: 0, ticks: RUN_LIMIT_TICKS });
    const runThrough = playLog(CALM, planLog({ every: 15, aimAt: 2_300, hold: 5 }));
    expect(runThrough).toMatchObject({ score: 0, foul: true, takeoffX: -1 });
    expect(runThrough.tick).toBeLessThan(RUN_LIMIT_TICKS);
  });
});

describe("saut en longueur : l'appel et le vol", () => {
  it("un appel au-delà de la planche est mordu", () => {
    const plan = boardPlan(CALM, 15, 60);
    const fouled = playLog(CALM, planLog({ ...plan, aimAt: plan.aimAt + 1 }));
    expect(fouled).toMatchObject({ score: 0, foul: true, takeoffX: -1 });
    expect(fouled.x).toBeGreaterThan(BOARD_X);
  });

  it("la marque se mesure depuis la planche : l'appel pris avant elle coûte sa distance", () => {
    const plan = boardPlan(CALM, 15, 60);
    const close = jump(CALM, planLog(plan));
    const early = jump(CALM, planLog({ ...plan, aimAt: plan.aimAt - 40 }));
    expect(close.score).toBe(markOf(close.state as never));
    expect(close.score).toBeGreaterThan(early.score);
  });

  it("huit appuis par seconde et la planche au plus près donnent entre 7 et 8 m ; cinq par seconde, au moins un mètre de moins", () => {
    const good = jump(CALM, planLog(boardPlan(CALM, 15, 72))).score;
    expect(good).toBeGreaterThan(7_000);
    expect(good).toBeLessThan(8_000);
    expect(jump(CALM, planLog(boardPlan(CALM, 24, 72))).score).toBeLessThan(good - 1_000);
  });

  it("prendre de l'angle coûte de la vitesse : trop peu ou trop d'angle, le saut est plus court", () => {
    const at = (hold: number) => jump(CALM, planLog(boardPlan(CALM, 15, hold))).score;
    expect(at(64)).toBeGreaterThan(at(24));
    expect(at(64)).toBeGreaterThan(at(118));
  });

  it("vole d'autant plus loin et plus haut que l'élan est grand", () => {
    const slow = flightOf(6_000, 30, 0);
    const fast = flightOf(10_000, 30, 0);
    expect(fast.distance).toBeGreaterThan(slow.distance);
    expect(fast.peak).toBeGreaterThan(slow.peak);
    expect(fast.ticks).toBeGreaterThan(slow.ticks);
  });
});

describe("saut en longueur : la réception", () => {
  it("un saut qui retombe avant le sable ne compte pas", () => {
    const plan = boardPlan(CALM, 15, 60);
    const short = jump(CALM, planLog({ ...plan, aimAt: plan.aimAt - 300 }));
    expect(short.score).toBe(0);
    expect(short.state).toMatchObject({ short: true, foul: false });
  });
});

describe("saut en longueur : plafond théorique", () => {
  it("vaut le meilleur angle, à la vitesse maximale, par vent de +2,0 m/s", () => {
    expect(LONG_JUMP_BEST_MM).toBe(9_378);
  });

  it("n'est battu par aucun plan, ni par aucun journal pseudo-aléatoire", () => {
    for (const every of [4, 8, 12, 15]) {
      for (const hold of [20, 50, 70, 90]) {
        const result = jump(TAILWIND, planLog(boardPlan(TAILWIND, every, hold)));
        expect(result.score).toBeLessThanOrEqual(LONG_JUMP_BEST_MM);
      }
    }
    for (let seed = 1; seed <= 300; seed += 1) {
      const result = replay(longJump, TAILWIND, fuzzLog(seed));
      if (result.ok) expect(result.score).toBeLessThanOrEqual(LONG_JUMP_BEST_MM);
    }
  });
});
