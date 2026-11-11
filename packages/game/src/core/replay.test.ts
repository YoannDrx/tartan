import { describe, expect, it } from "vitest";
import { hurdles } from "../events/hurdles";
import { HURDLES_FUZZ, HURDLES_REFERENCE_RUNS, fuzzLog, fuzzSummary } from "../reference";
import { MAX_LOG_EVENTS, MAX_TICKS, SIM_VERSION } from "./constants";
import { MAX_ENTRY, decodeLog, encodeEntry } from "./log";
import { replay } from "./replay";
import { type SimState, defineEvent, isPlausibleScore } from "./sim";

// Épreuve d'essai à deux canaux : elle compte les changements d'appui et s'arrête au pas voulu.
interface ProbeState extends SimState {
  readonly presses: number;
  readonly releases: number;
  readonly bothHeld: number;
}

const probe = (lastTick: number) =>
  defineEvent<ProbeState>({
    id: "probe",
    channels: 2,
    scoreUnit: "mm",
    lowerIsBetter: false,
    best: 1_000_000,
    start: (_seed, base) => ({ ...base, presses: 0, releases: 0, bothHeld: 0 }),
    advance: (state, edges) => {
      const count = (mask: number) => (mask & 1) + (mask >> 1);
      const presses = state.presses + count(edges.pressed);
      const releases = state.releases + count(edges.released);
      const bothHeld = state.bothHeld + (edges.held === 3 ? 1 : 0);
      const score = state.tick + 1 >= lastTick ? presses * 100 + releases : null;
      return { ...state, presses, releases, bothHeld, score };
    },
  });

describe("parties de référence", () => {
  it.each(HURDLES_REFERENCE_RUNS)("$name : graine et journal figés, score figé", (run) => {
    const result = replay(hurdles, run.seed, run.inputs);
    expect(result).toMatchObject({
      ok: true,
      version: SIM_VERSION,
      score: run.score,
      ticks: run.ticks,
      digest: run.digest,
    });
  });

  it.each(HURDLES_REFERENCE_RUNS)("$name : rejouée deux fois, même résultat au champ près", (run) => {
    expect(replay(hurdles, run.seed, run.inputs)).toEqual(replay(hurdles, run.seed, [...run.inputs]));
  });

  it.each(HURDLES_REFERENCE_RUNS)("$name : pas à pas ou en relecture, même état final", (run) => {
    const transitions = decodeLog(run.inputs);
    let state = hurdles.init(run.seed);
    let held = 0;
    let cursor = 0;
    while (!state.finished) {
      while (transitions[cursor]?.tick === state.tick) {
        held = transitions[cursor]?.press ? 1 : 0;
        cursor += 1;
      }
      state = hurdles.step(state, held);
    }
    const result = replay(hurdles, run.seed, run.inputs);
    expect(result.ok && result.state).toEqual(state);
  });

  it("300 journaux pseudo-aléatoires donnent le résumé figé", () => {
    expect(fuzzSummary(hurdles, HURDLES_FUZZ.from, HURDLES_FUZZ.count)).toBe(HURDLES_FUZZ.summary);
  });

  it("un autre journal ou une autre graine donnent une autre empreinte", () => {
    const [run] = HURDLES_REFERENCE_RUNS;
    if (!run) throw new Error("aucune partie de référence");
    const shifted = [...run.inputs];
    shifted[0] = (shifted[0] ?? 0) + (1 << 2);
    const other = replay(hurdles, run.seed, shifted);
    expect(other.ok && other.digest).not.toBe(run.digest);
    const otherSeed = replay(hurdles, run.seed + 1, run.inputs);
    expect(otherSeed.ok && otherSeed.digest).not.toBe(run.digest);
  });
});

describe("journaux refusés", () => {
  const press = (delta: number, channel = 0) => encodeEntry(delta, channel, true);
  const release = (delta: number, channel = 0) => encodeEntry(delta, channel, false);

  it("accepte 2 000 changements, refuse le 2 001e", () => {
    const full = Array.from({ length: MAX_LOG_EVENTS }, (_, index) => encodeEntry(index % 2, index % 2, index % 4 < 2));
    expect(replay(probe(1_200), 1, full)).toMatchObject({ ok: true, ticks: 1_200, score: 1_000 * 100 + 1_000 });
    expect(replay(probe(1_200), 1, [...full, press(1)])).toEqual({ ok: false, error: "too-many-events", index: -1 });
  });

  it("refuse un changement au-delà des 90 s", () => {
    expect(replay(probe(MAX_TICKS), 1, [press(MAX_TICKS - 1)])).toMatchObject({ ok: true, ticks: MAX_TICKS });
    expect(replay(probe(MAX_TICKS), 1, [press(5_400), release(5_400)])).toEqual({
      ok: false,
      error: "too-long",
      index: 1,
    });
  });

  it("refuse une partie qui n'est pas finie au bout des 90 s", () => {
    expect(replay(probe(MAX_TICKS + 1), 1, [press(3)])).toEqual({ ok: false, error: "unfinished", index: -1 });
  });

  it.each([
    ["un nombre négatif", -1],
    ["un nombre à virgule", 4.5],
    ["NaN", Number.NaN],
    ["l'infini", Number.POSITIVE_INFINITY],
    ["une valeur au-delà de la plus grande entrée", MAX_ENTRY + 1],
    ["une chaîne", "5"],
    ["null", null],
    ["un trou", undefined],
  ])("refuse une entrée mal formée : %s", (_label, entry) => {
    const log = [press(10), entry, release(10)] as number[];
    expect(replay(hurdles, 1, log)).toEqual({ ok: false, error: "malformed-entry", index: 1 });
  });

  it("refuse un journal qui n'est pas un tableau", () => {
    for (const log of [null, undefined, "1157,32", { length: 2, 0: 1, 1: 4 }, new Uint32Array([1, 4])]) {
      expect(replay(hurdles, 1, log as unknown as number[])).toEqual({ ok: false, error: "malformed-log", index: -1 });
    }
  });

  it("refuse un canal que l'épreuve ne lit pas", () => {
    expect(replay(hurdles, 1, [press(10, 1)])).toEqual({ ok: false, error: "unknown-channel", index: 0 });
    expect(replay(probe(60), 1, [press(10, 1)])).toMatchObject({ ok: true });
  });

  it("refuse un appui sur un canal déjà tenu et un relâchement d'un canal libre", () => {
    expect(replay(hurdles, 1, [press(10), press(5)])).toEqual({ ok: false, error: "repeated-transition", index: 1 });
    expect(replay(hurdles, 1, [release(10)])).toEqual({ ok: false, error: "repeated-transition", index: 0 });
  });

  it("refuse deux changements du même canal au même pas, pas ceux de deux canaux", () => {
    expect(replay(hurdles, 1, [press(10), release(0)])).toEqual({ ok: false, error: "repeated-transition", index: 1 });
    expect(replay(probe(60), 1, [press(10, 0), press(0, 1), release(1, 1), release(0, 0)])).toMatchObject({
      ok: true,
      state: { presses: 2, releases: 2, bothHeld: 1 },
    });
  });

  it("refuse un changement daté après l'arrivée", () => {
    const run = HURDLES_REFERENCE_RUNS[1];
    if (!run) throw new Error("aucune partie de référence");
    expect(replay(hurdles, run.seed, [press(run.ticks - 1)])).toMatchObject({ ok: true });
    expect(replay(hurdles, run.seed, [press(run.ticks)])).toEqual({
      ok: false,
      error: "input-after-finish",
      index: 0,
    });
  });

  it.each([-1, 1.5, 0x1_0000_0000, Number.NaN, "7"])("refuse la graine %s", (seed) => {
    expect(replay(hurdles, seed as number, [])).toEqual({ ok: false, error: "invalid-seed", index: -1 });
  });

  it("ne lève jamais d'exception sur un journal pseudo-aléatoire, valide ou non", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const log = fuzzLog(seed).map((entry, index) => (index % 7 === 3 ? entry ^ 2 : entry));
      expect(typeof replay(hurdles, seed, log).ok).toBe("boolean");
    }
  });
});

describe("plafond théorique", () => {
  it("laisse passer le plafond et tout score moins bon, refuse un score meilleur", () => {
    expect(isPlausibleScore(hurdles, hurdles.best)).toBe(true);
    expect(isPlausibleScore(hurdles, hurdles.best + 1)).toBe(true);
    expect(isPlausibleScore(hurdles, hurdles.best - 1)).toBe(false);
    expect(isPlausibleScore(hurdles, 12_900.5)).toBe(false);
    expect(isPlausibleScore(probe(10), 1_000_000)).toBe(true);
    expect(isPlausibleScore(probe(10), 1_000_001)).toBe(false);
  });
});
