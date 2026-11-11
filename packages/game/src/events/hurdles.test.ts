import { describe, expect, it } from "vitest";
import { decodeLog } from "../core/log";
import { replay } from "../core/replay";
import { fuzzLog } from "../reference";
import {
  APEX_TICK,
  CLEAR_WINDOW,
  FINISH_X,
  FLIGHT_TICKS,
  GRADE,
  HURDLES_BEST_MS,
  HURDLE_COUNT,
  HURDLE_HEIGHT_MM,
  type HurdlesState,
  MAX_WIND,
  RECOVER_TICKS,
  clockMs,
  cruiseSpeed,
  hurdleX,
  hurdles,
  isHurdleDown,
  jumpHeight,
  phaseOf,
  toMillimetres,
  windOf,
} from "./hurdles";
import { perfectLog, scriptedLog } from "./hurdles.bots";

const seedWithWind = (wind: number): number => {
  for (let seed = 0; seed < 100_000; seed += 1) if (windOf(seed) === wind) return seed;
  throw new Error(`aucune graine pour le vent ${wind}`);
};

const every = (offset: number | null) => Array.from({ length: HURDLE_COUNT }, () => offset);

const race = (seed: number, log: readonly number[]) => {
  const result = replay(hurdles, seed, log);
  if (!result.ok) throw new Error(result.error);
  return result;
};

const TAILWIND = seedWithWind(MAX_WIND);
const CALM = seedWithWind(0);

describe("110 m haies : conditions", () => {
  it("place dix haies de 13,72 m à 95,98 m, puis la ligne à 110 m", () => {
    expect(toMillimetres(hurdleX(0))).toBe(13_720);
    expect(toMillimetres(hurdleX(HURDLE_COUNT - 1))).toBe(95_980);
    expect(toMillimetres(FINISH_X)).toBe(110_000);
  });

  it("tire de la graine un vent entre −2,0 et +2,0 m/s, toujours le même", () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 5_000; seed += 1) {
      const wind = windOf(seed);
      expect(wind).toBe(windOf(seed));
      expect(wind).toBeGreaterThanOrEqual(-MAX_WIND);
      expect(wind).toBeLessThanOrEqual(MAX_WIND);
      seen.add(wind);
    }
    expect(seen.size).toBe(2 * MAX_WIND + 1);
    expect(hurdles.init(TAILWIND).wind).toBe(MAX_WIND);
  });

  it("court plus vite vent dans le dos que vent de face", () => {
    const times = [-MAX_WIND, -8, 0, 8, MAX_WIND].map((wind) => {
      const seed = seedWithWind(wind);
      return race(seed, perfectLog(seed)).score;
    });
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(new Set(times).size).toBe(times.length);
  });
});

describe("110 m haies : franchissements", () => {
  it.each([
    [0, GRADE.perfect],
    [2, GRADE.perfect],
    [-2, GRADE.perfect],
    [3, GRADE.good],
    [-6, GRADE.good],
    [7, GRADE.early],
    [11, GRADE.early],
    [-7, GRADE.late],
    [-11, GRADE.late],
    [12, GRADE.clipped],
    [-12, GRADE.clipped],
    [null, GRADE.crashed],
  ])("un écart de %s pas au sommet donne la note %s", (offset, grade) => {
    const { state } = race(CALM, scriptedLog(CALM, every(offset)));
    expect(state.hurdles).toEqual(every(grade));
    expect(state.lastOffset).toBe(offset ?? 0);
    expect(state.hurdles.every(isHurdleDown)).toBe(grade === GRADE.clipped || grade === GRADE.crashed);
  });

  it("fait payer chaque pas d'écart, dans l'ordre : parfait, bon, touchée, renversée, percutée", () => {
    const times = [0, 1, 2, 4, 6, 8, 11, 12, null].map((offset) => race(CALM, scriptedLog(CALM, every(offset))).score);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(times.length);
  });

  it("monte la vitesse de croisière avec les franchissements propres, la casse sur une haie tombée", () => {
    const clean = race(CALM, perfectLog(CALM)).state;
    expect(clean.rhythm).toBe(2 * HURDLE_COUNT);
    expect(race(CALM, scriptedLog(CALM, every(4))).state.rhythm).toBe(HURDLE_COUNT);
    const broken = race(CALM, scriptedLog(CALM, [0, 0, 0, 0, 0, 0, 0, 0, 0, null])).state;
    expect(broken.rhythm).toBe(0);
    const touched = race(CALM, scriptedLog(CALM, [0, 0, 0, 0, 0, 0, 0, 0, 0, 9])).state;
    expect(touched.rhythm).toBe(9);
    expect(cruiseSpeed(0, clean.rhythm)).toBeGreaterThan(cruiseSpeed(0, 0));
    expect(clean.v).toBeGreaterThan(broken.v);
  });

  it("ralentit net sur une haie renversée", () => {
    let state = hurdles.init(CALM);
    while (state.next === 0) {
      const before = state;
      state = hurdles.step(state, 0);
      if (state.next === 1) {
        expect(state.hurdles[0]).toBe(GRADE.crashed);
        expect(state.v).toBeLessThan(before.v - (before.v >> 2));
      }
    }
  });

  it("tient la haie exactement quand le pied passe au-dessus de la barre", () => {
    for (let air = 1; air <= FLIGHT_TICKS; air += 1) {
      const offset = air < APEX_TICK ? APEX_TICK - air : air - APEX_TICK;
      expect(jumpHeight(air) >= HURDLE_HEIGHT_MM).toBe(offset <= CLEAR_WINDOW);
    }
    expect(jumpHeight(0)).toBe(0);
    expect(jumpHeight(FLIGHT_TICKS + 1)).toBe(0);
    expect(jumpHeight(APEX_TICK)).toBeGreaterThan(jumpHeight(APEX_TICK - 1));
  });
});

describe("110 m haies : le geste", () => {
  it("un appui lance un saut de 41 pas, suivi de 6 pas de reprise ; tenir ne relance rien", () => {
    let state = hurdles.init(CALM);
    for (let tick = 0; tick < 30; tick += 1) state = hurdles.step(state, 0);
    expect(phaseOf(state)).toBe("run");
    const phases: string[] = [];
    const heights: number[] = [];
    for (let tick = 0; tick < FLIGHT_TICKS + RECOVER_TICKS + 20; tick += 1) {
      state = hurdles.step(state, 1);
      phases.push(phaseOf(state));
      heights.push(jumpHeight(state.air));
    }
    const flight = Array.from({ length: FLIGHT_TICKS }, () => "flight");
    const landing = Array.from({ length: RECOVER_TICKS }, () => "landing");
    expect(phases.slice(0, FLIGHT_TICKS + RECOVER_TICKS)).toEqual([...flight, ...landing]);
    expect(phases.slice(FLIGHT_TICKS + RECOVER_TICKS).every((phase) => phase === "run")).toBe(true);
    // La trajectoire que le rendu dessine est symétrique autour du sommet.
    const arc = heights.slice(0, FLIGHT_TICKS);
    expect(arc).toEqual([...arc].reverse());
    expect(arc[APEX_TICK - 1]).toBe(Math.max(...arc));
    expect(heights.slice(FLIGHT_TICKS).every((height) => height === 0)).toBe(true);
  });

  it("ignore un appui en l'air ou pendant la reprise", () => {
    let state = hurdles.init(CALM);
    state = hurdles.step(state, 1);
    expect(state.air).toBe(1);
    state = hurdles.step(state, 0);
    state = hurdles.step(state, 1);
    expect(state.air).toBe(3);
    while (state.air > 0) state = hurdles.step(state, 0);
    expect(state.recover).toBe(RECOVER_TICKS);
    state = hurdles.step(state, 1);
    expect(state.air).toBe(0);
    state = hurdles.step(state, 0);
    while (state.recover > 1) state = hurdles.step(state, 0);
    // Dernier pas de reprise écoulé : l'appui suivant relance un saut.
    state = hurdles.step(state, 1);
    expect(state.air).toBe(1);
  });

  it("ne lit que le canal 0", () => {
    const start = hurdles.init(CALM);
    expect(hurdles.step(start, 2)).toEqual(hurdles.step(start, 0));
    expect(hurdles.step(start, 3)).toEqual(hurdles.step(start, 1));
  });
});

describe("110 m haies : ce que le rendu reçoit à chaque pas", () => {
  it("donne position, vitesse, phase et état des haies, sans jamais reculer", () => {
    const seed = 20_261_111;
    const transitions = decodeLog(scriptedLog(seed, [0, -3, 5, null, 1, 9, -12, 2, -7, 0], 5));
    let state = hurdles.init(seed);
    let held = 0;
    let cursor = 0;
    let flights = 0;
    while (!state.finished) {
      const previous = state;
      if (transitions[cursor]?.tick === state.tick) {
        held = transitions[cursor]?.press ? 1 : 0;
        cursor += 1;
      }
      state = hurdles.step(state, held);
      expect(state.tick).toBe(previous.tick + 1);
      expect(state.x).toBeGreaterThan(previous.x);
      expect(state.v).toBeGreaterThan(0);
      expect(state.next - previous.next === 0 || state.next - previous.next === 1).toBe(true);
      expect(state.hurdles.filter((grade) => grade !== GRADE.pending)).toHaveLength(state.next);
      expect(jumpHeight(state.air) > 0).toBe(phaseOf(state) === "flight");
      if (state.next > previous.next) {
        expect(previous.x).toBeLessThan(hurdleX(previous.next));
        expect(state.x).toBeGreaterThanOrEqual(hurdleX(previous.next));
      }
      if (previous.air === 0 && state.air > 0) flights += 1;
    }
    expect(cursor).toBe(transitions.length);
    expect(flights).toBe(9);
    expect(state.hurdles).toEqual([1, 2, 2, 6, 1, 3, 5, 1, 4, 1]);
    expect(state.hurdles.filter(isHurdleDown)).toHaveLength(2);
    expect(state.x).toBeGreaterThanOrEqual(FINISH_X);
    expect(phaseOf(state)).toBe("finished");
  });

  it("ne modifie jamais l'état reçu, et ne bouge plus une fois l'arrivée franchie", () => {
    const freeze = (state: HurdlesState): HurdlesState => {
      Object.freeze(state.hurdles);
      return Object.freeze(state);
    };
    let state = freeze(hurdles.init(TAILWIND));
    const log = perfectLog(TAILWIND);
    const pressTicks = new Set<number>();
    let tick = 0;
    log.forEach((entry, index) => {
      tick += entry >>> 2;
      if (index % 2 === 0) pressTicks.add(tick);
    });
    while (!state.finished) state = freeze(hurdles.step(state, pressTicks.has(state.tick) ? 1 : 0));
    expect(state.score).toBe(HURDLES_BEST_MS);
    expect(hurdles.step(state, 1)).toBe(state);
  });

  it("prend le temps sur la ligne, entre le dernier pas et le suivant", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const result = replay(hurdles, seed, fuzzLog(seed));
      if (!result.ok) continue;
      expect(result.score).toBeGreaterThanOrEqual(clockMs(result.ticks - 1));
      expect(result.score).toBeLessThanOrEqual(clockMs(result.ticks) + 1);
    }
  });
});

describe("110 m haies : plafond théorique", () => {
  it("vaut la course parfaite par vent de +2,0 m/s", () => {
    expect(race(TAILWIND, perfectLog(TAILWIND)).score).toBe(HURDLES_BEST_MS);
    expect(hurdles.best).toBe(HURDLES_BEST_MS);
  });

  it("n'est battu par aucun vent", () => {
    for (let wind = -MAX_WIND; wind <= MAX_WIND; wind += 1) {
      const seed = seedWithWind(wind);
      expect(race(seed, perfectLog(seed)).score).toBeGreaterThanOrEqual(HURDLES_BEST_MS);
    }
  });

  it("n'est battu par aucun écart sur une haie, ni par aucun mélange d'écarts", () => {
    for (let hurdle = 0; hurdle < HURDLE_COUNT; hurdle += 1) {
      for (const offset of [-2, -1, 1, 2, null]) {
        const offsets = every(0).map((zero, index) => (index === hurdle ? offset : zero));
        expect(race(TAILWIND, scriptedLog(TAILWIND, offsets)).score).toBeGreaterThanOrEqual(HURDLES_BEST_MS);
      }
    }
    // Mélanges tirés d'une suite fixe. Un seul pas d'écart peut coûter moins d'une milliseconde : égaler, jamais battre.
    let state = 12_345;
    for (let round = 0; round < 150; round += 1) {
      const offsets = every(0).map(() => {
        state = (Math.imul(state, 1_103_515_245) + 12_345) & 0x7fff_ffff;
        return ((state >> 16) % 5) - 2;
      });
      const { score } = race(TAILWIND, scriptedLog(TAILWIND, offsets));
      expect(score).toBeGreaterThanOrEqual(HURDLES_BEST_MS);
    }
  });

  it("n'est battu par aucun journal pseudo-aléatoire par vent maximal", () => {
    for (let seed = 1; seed <= 150; seed += 1) {
      const result = replay(hurdles, TAILWIND, fuzzLog(seed));
      if (result.ok) expect(result.score).toBeGreaterThan(HURDLES_BEST_MS);
    }
  });
});
