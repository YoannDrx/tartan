// Mesure de bout en bout du planificateur : notation sur des sorties fabriquées, coût, arrêt au budget, gel du
// corpus et options. Aucune base ni réseau ici ; le passage complet par le service est dans
// planner-e2e-service.test.ts.
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { e2eCase, e2eCorpus, type E2eCase } from "../evals/e2e/format";
import { FreezeError, freezeFile, loadFrozenCorpus, loadFrozenPairs } from "../evals/e2e/freeze";
import type { Observed, ObservedMovement, ObservedRef, ObservedSession, ObservedStep } from "../evals/e2e/observation";
import { assertEvalDatabase, OptionError, parseOptions } from "../evals/e2e/options";
import { scorePair } from "../evals/e2e/pairs/format";
import { costOf, priceOf, sumCosts } from "../evals/e2e/prices";
import { median, renderSummary, summarize, type CaseRow, type PairRow, type StepUsage } from "../evals/e2e/report";
import { runE2e, type E2eDriver } from "../evals/e2e/runner";
import { scoreCase } from "../evals/e2e/score";
import { checkThresholds, E2E_THRESHOLDS } from "../evals/e2e/thresholds";

const folder = path.resolve(import.meta.dirname, "../evals/e2e");
const examplesFile = path.join(folder, "corpus/examples.json");
const pairsFile = path.join(folder, "pairs/examples.json");
const examples = loadFrozenCorpus(examplesFile);
const examplePairs = loadFrozenPairs(pairsFile);
const example = (id: string) => examples.corpus.cases.find((test) => test.id === id)!;

const catalog = (key: string): ObservedRef => ({ kind: "catalog", key });
const movement = (ref: ObservedRef, overrides: Partial<ObservedMovement> = {}): ObservedMovement => ({
  type: "movement",
  ref,
  toVerify: false,
  flags: [],
  sets: 1,
  reps: null,
  durationS: null,
  distanceM: null,
  restS: null,
  load: null,
  setPlan: null,
  family: null,
  equipment: null,
  ...overrides,
});
const session = (date: string, steps: ObservedStep[], overrides: Partial<ObservedSession> = {}): ObservedSession => ({
  date,
  durationMin: 45,
  recipients: { groups: ["Sprint"], athletes: [] },
  flags: [],
  steps,
  ...overrides,
});
const answered = (...sessions: ObservedSession[]): Observed => ({
  status: "sessions",
  blocked: false,
  questions: [],
  sessions,
  error: null,
});
const asked = (reason: Observed["questions"][number]["reason"], exerciseName: string | null = null): Observed => ({
  status: "question",
  blocked: true,
  questions: [{ reason, exerciseName, options: [] }],
  sessions: [],
  error: null,
});
const squat = (overrides: Partial<ObservedMovement> = {}) =>
  movement(catalog("back-squat"), { sets: 3, reps: 8, restS: 90, ...overrides });

describe("format v2", () => {
  it("accepte les six exemples et refuse un cas mal formé", () => {
    expect(examples.corpus.cases).toHaveLength(6);
    const broken = (change: (test: Record<string, unknown>) => void) => {
      const copy = structuredClone(example("EX-01")) as unknown as Record<string, unknown>;
      change(copy);
      return e2eCase.safeParse(copy).success;
    };
    // Ni question attendue ni question interdite, ou les deux.
    expect(broken((test) => delete (test.expect as Record<string, unknown>).mustNotAsk)).toBe(false);
    expect(broken((test) => ((test.expect as Record<string, unknown>).mustAsk = { reason: "no_date" }))).toBe(false);
    // Un cas décrit attend des mouvements, pas des bornes.
    expect(broken((test) => (test.kind = "objective"))).toBe(false);
    // Un mouvement n'a qu'une identité, et sa charge se dit toujours, même nulle.
    const step = (value: unknown) =>
      broken((test) => {
        (test.expect as { sessions: { steps: unknown[] }[] }).sessions[0]!.steps = [value];
      });
    expect(step({ key: "back-squat", private: "Squat maison", load: null })).toBe(false);
    expect(step({ key: "back-squat" })).toBe(false);
    expect(step({ absent: true, load: null })).toBe(false);
    expect(step({ private: "Fiche jamais déclarée", load: null })).toBe(false);
    expect(step({ key: "back-squat", load: { value: 60 } })).toBe(false);
    expect(step({ key: "back-squat", load: { value: 60, unit: "kg" } })).toBe(true);
  });

  it("refuse deux cas du même identifiant", () => {
    const twice = { version: 2, cases: [example("EX-01"), example("EX-01")] };
    expect(e2eCorpus.safeParse(twice).success).toBe(false);
  });
});

describe("notation d'un cas décrit", () => {
  const test = example("EX-01");

  it("juge juste la séance que le coach a décrite", () => {
    const score = scoreCase(test, answered(session("2026-11-23", [squat()])));
    expect(score).toMatchObject({ passed: true, differences: [], faults: [], critical: [], needlessQuestion: false });
  });

  it("relève une question inutile", () => {
    const score = scoreCase(test, asked("rest"));
    expect(score.passed).toBe(false);
    expect(score.needlessQuestion).toBe(true);
    expect(score.differences).toEqual(["needless_question"]);
    expect(score.critical).toEqual([]);
  });

  it("relève une charge inventée comme une faute grave", () => {
    const score = scoreCase(test, answered(session("2026-11-23", [squat({ load: { value: 40, unit: "kg" } })])));
    expect(score.passed).toBe(false);
    expect(score.faults).toEqual(["invented_load"]);
    expect(score.critical).toEqual(["invented_load"]);
    // Aussi dans une série détaillée que le coach n'a pas dite.
    const inPlan = scoreCase(
      test,
      answered(
        session("2026-11-23", [squat({ setPlan: [{ reps: 8, load: { value: 20, unit: "kg" }, warmup: true }] })]),
      ),
    );
    expect(inPlan.critical).toEqual(["invented_load"]);
  });

  it("relève un exercice ajouté que le coach n'a pas dit", () => {
    const score = scoreCase(
      test,
      answered(session("2026-11-23", [squat(), movement(catalog("front-plank"), { sets: 3, durationS: 30 })])),
    );
    expect(score.faults).toEqual(["added_exercise"]);
    expect(score.critical).toEqual(["added_exercise"]);
  });

  it("relève une date fausse, et compare quand même la séance", () => {
    const score = scoreCase(test, answered(session("2026-11-24", [squat({ reps: 10 })])));
    expect(score.critical).toEqual(["wrong_date"]);
    expect(score.differences).toEqual(expect.arrayContaining(["wrong_date", "reps"]));
  });

  it("distingue un remplacement silencieux d'un rapprochement marqué « À vérifier »", () => {
    const silent = scoreCase(test, answered(session("2026-11-23", [squat({ ref: catalog("front-squat") })])));
    expect(silent.critical).toEqual(["wrong_exercise"]);
    const shown = scoreCase(
      test,
      answered(session("2026-11-23", [squat({ ref: catalog("front-squat"), toVerify: true })])),
    );
    expect(shown.passed).toBe(false);
    expect(shown.differences).toEqual(["exercise"]);
    expect(shown.faults).toEqual([]);
    // La bonne fiche, simplement marquée à vérifier, reste juste.
    expect(scoreCase(test, answered(session("2026-11-23", [squat({ toVerify: true })]))).passed).toBe(true);
  });

  it("ne tient une faute pour grave que si le cas la déclare", () => {
    const lenient: E2eCase = { ...test, expect: { ...test.expect, critical: ["wrong_date"] } };
    const score = scoreCase(lenient, answered(session("2026-11-23", [squat({ load: { value: 40, unit: "kg" } })])));
    expect(score.faults).toEqual(["invented_load"]);
    expect(score.critical).toEqual([]);
    expect(score.passed).toBe(false);
  });

  it("compare chaque champ écrit, les destinataires et le nombre de séances", () => {
    const score = scoreCase(
      test,
      answered(
        session("2026-11-23", [squat({ sets: 4, restS: 60 })], { recipients: { groups: ["Demi-fond"], athletes: [] } }),
        session("2026-11-23", [squat()]),
      ),
    );
    expect(score.differences).toEqual(
      expect.arrayContaining(["sets", "rest", "recipients", "extra_session", "session_count"]),
    );
    expect(score.faults).toEqual([]);
  });

  it("tient une panne pour un échec, jamais pour une question", () => {
    const score = scoreCase(test, {
      status: "error",
      blocked: false,
      questions: [],
      sessions: [],
      error: "planner_timeout",
    });
    expect(score).toMatchObject({ passed: false, differences: ["error"], needlessQuestion: false });
  });
});

describe("notation de la structure", () => {
  const test = example("EX-02");
  const circuit = (rounds = 3, rest = 60): ObservedStep => ({
    type: "group",
    rounds,
    restBetweenRoundsS: rest,
    steps: [
      movement(catalog("split-jumps"), { reps: 10 }),
      movement(catalog("front-plank"), { durationS: 20 }),
      movement({ kind: "private", name: "tirage élastique MAISON" }, { reps: 8 }),
    ],
  });
  const bench = movement(catalog("bench-press"), {
    sets: 4,
    reps: 6,
    restS: 120,
    load: { value: 60, unit: "kg" },
  });
  const sauteurs = { recipients: { groups: ["Sauteurs"], athletes: [] } };

  it("accepte le circuit, la fiche privée et la charge dite", () => {
    const score = scoreCase(test, answered(session("2026-11-24", [circuit(), bench], sauteurs)));
    expect(score.passed).toBe(true);
  });

  it("relève des tours faux, un repos entre tours faux et un circuit aplati", () => {
    const rounds = scoreCase(test, answered(session("2026-11-24", [circuit(4, 90), bench], sauteurs)));
    expect(rounds.differences).toEqual(["rounds", "round_rest"]);
    const flat = scoreCase(
      test,
      answered(session("2026-11-24", [...(circuit() as { steps: ObservedStep[] }).steps, bench], sauteurs)),
    );
    expect(flat.differences).toEqual(["structure"]);
    expect(flat.faults).toEqual([]);
  });

  it("tient un exercice déplacé pour un écart d'ordre, pas pour un remplacement", () => {
    const score = scoreCase(test, answered(session("2026-11-24", [bench, circuit()], sauteurs)));
    expect(score.differences).toEqual(["order"]);
    expect(score.faults).toEqual([]);
  });

  it("tient trois tours d'un seul exercice pour trois séries", () => {
    const tours: ObservedStep = {
      type: "group",
      rounds: 3,
      restBetweenRoundsS: 90,
      steps: [movement(catalog("back-squat"), { reps: 8 })],
    };
    expect(scoreCase(example("EX-01"), answered(session("2026-11-23", [tours]))).passed).toBe(true);
  });
});

describe("notation d'une fiche absente", () => {
  const test = example("EX-03");
  const demiFond = { recipients: { groups: ["Demi-fond"], athletes: [] } };
  const side = movement(catalog("side-plank"), { sets: 3, durationS: 30, restS: 45 });
  const copenhagen = (ref: ObservedRef, overrides: Partial<ObservedMovement> = {}) =>
    movement(ref, { sets: 3, durationS: 20, ...overrides });

  it("accepte l'emplacement à compléter laissé à sa place", () => {
    const score = scoreCase(
      test,
      answered(
        session("2026-11-25", [copenhagen({ kind: "placeholder", name: "planche Copenhague" }), side], demiFond),
      ),
    );
    expect(score).toMatchObject({ passed: true, faults: [] });
  });

  it("refuse une fiche mise à la place, et la tient pour grave sans marque « À vérifier »", () => {
    const silent = scoreCase(
      test,
      answered(session("2026-11-25", [copenhagen(catalog("front-plank")), side], demiFond)),
    );
    expect(silent.differences).toEqual(expect.arrayContaining(["absent_filled", "wrong_exercise"]));
    expect(silent.critical).toEqual(["wrong_exercise"]);
    const shown = scoreCase(
      test,
      answered(session("2026-11-25", [copenhagen(catalog("front-plank"), { toVerify: true }), side], demiFond)),
    );
    expect(shown.differences).toEqual(["absent_filled"]);
    expect(shown.critical).toEqual([]);
  });

  it("tient la question sur la fiche absente pour une question inutile", () => {
    const score = scoreCase(test, asked("exercise", "planche Copenhague"));
    expect(score.needlessQuestion).toBe(true);
    expect(score.notes[0]).toContain("planche Copenhague");
  });

  it("relève une fiche existante laissée à compléter", () => {
    const score = scoreCase(
      example("EX-01"),
      answered(session("2026-11-23", [squat({ ref: { kind: "placeholder", name: "squat arrière" } })])),
    );
    expect(score.differences).toEqual(["fiche_not_found"]);
    expect(score.faults).toEqual([]);
  });
});

describe("notation d'un objectif", () => {
  const test = example("EX-04");
  const free = (key: string, family: string, overrides: Partial<ObservedMovement> = {}) =>
    movement(catalog(key), { sets: 3, reps: 10, family, equipment: [], ...overrides });
  const proposal = (steps: ObservedStep[], durationMin: number | null = 40) =>
    answered(session("2026-11-26", steps, { durationMin }));
  const good = [
    free("front-plank", "core"),
    free("dead-bug", "core"),
    free("pogo-jumps", "plyometrics"),
    free("squat-jump", "plyometrics"),
  ];

  it("accepte toute séance qui tient les bornes", () => {
    expect(scoreCase(test, proposal(good)).passed).toBe(true);
    expect(scoreCase(test, proposal([...good, free("bird-dog", "core")], 35)).passed).toBe(true);
  });

  it("relève chaque borne dépassée", () => {
    expect(scoreCase(test, proposal(good.slice(0, 3))).differences).toEqual(["exercise_count"]);
    expect(scoreCase(test, proposal(good, 50)).differences).toEqual(["duration_over"]);
    expect(scoreCase(test, proposal(good, null)).differences).toEqual(["duration_missing"]);
    expect(scoreCase(test, proposal(good.map((m) => ({ ...m, family: "core" })))).differences).toEqual([
      "family_missing",
    ]);
    const barbell = [...good.slice(0, 3), free("back-squat", "plyometrics", { equipment: ["barbell", "rack"] })];
    expect(scoreCase(test, proposal(barbell)).differences).toEqual(["equipment"]);
    const unknown = [...good.slice(0, 3), free("squat-jump", "plyometrics", { equipment: null })];
    expect(scoreCase(test, proposal(unknown)).differences).toEqual(["equipment_unknown"]);
  });

  it("tient un kilo proposé pour une charge inventée, pas un pourcentage", () => {
    const kilos = [...good.slice(0, 3), free("squat-jump", "plyometrics", { load: { value: 20, unit: "kg" } })];
    expect(scoreCase(test, proposal(kilos)).critical).toEqual(["invented_load"]);
    const percent = [...good.slice(0, 3), free("squat-jump", "plyometrics", { load: { value: 60, unit: "pct_1rm" } })];
    expect(scoreCase(test, proposal(percent)).passed).toBe(true);
  });

  it("refuse un emplacement à compléter dans une séance proposée", () => {
    const steps = [...good, movement({ kind: "placeholder", name: "gainage" })];
    expect(scoreCase(test, proposal(steps)).differences).toEqual(["placeholder"]);
  });
});

describe("notation d'une consigne mixte", () => {
  const test = example("EX-05");
  const lina = { recipients: { groups: [], athletes: ["Lina Morel"] }, durationMin: 35 };
  const jog = movement(catalog("warmup-jog"), { durationS: 1200, family: "warmup" });
  const mobility = (key: string, overrides: Partial<ObservedMovement> = {}) =>
    movement(catalog(key), { sets: 2, reps: 8, family: "mobility", equipment: [], ...overrides });

  it("retrouve ce que le coach a décrit et laisse composer le reste", () => {
    const steps = [jog, mobility("hip-90-90"), mobility("ankle-knee-wall")];
    expect(scoreCase(test, answered(session("2026-11-27", steps, lina))).passed).toBe(true);
  });

  it("relève la partie décrite absente et la borne non tenue, sans crier à l'exercice ajouté", () => {
    const steps = [mobility("hip-90-90"), mobility("ankle-knee-wall"), mobility("hip-car"), mobility("cat-cow")];
    const score = scoreCase(test, answered(session("2026-11-27", steps, { ...lina, durationMin: 50 })));
    expect(score.differences).toEqual(["missing_exercise", "duration_over"]);
    expect(score.faults).toEqual([]);
  });

  it("ne reproche pas ses kilos à un mouvement décrit, seulement aux mouvements proposés", () => {
    const steps = [jog, mobility("hip-90-90"), mobility("hip-car", { load: { value: 5, unit: "kg" } })];
    expect(scoreCase(test, answered(session("2026-11-27", steps, lina))).critical).toEqual(["invented_load"]);
  });
});

describe("notation d'une question attendue", () => {
  const test = example("EX-06");
  const cotes = session("2026-11-23", [movement(catalog("short-hill-sprint"), { sets: 8 })], {
    recipients: { groups: ["Demi-fond"], athletes: [] },
  });

  it("accepte la question sur le bon motif", () => {
    expect(scoreCase(test, asked("date"))).toMatchObject({ passed: true, needlessQuestion: false });
  });

  it("refuse une question sur un autre motif", () => {
    expect(scoreCase(test, asked("exercise")).differences).toEqual(["question_reason"]);
  });

  it("tient une séance datée d'office pour une date fausse", () => {
    const score = scoreCase(test, answered(cotes));
    expect(score.differences).toEqual(["missing_question", "wrong_date"]);
    expect(score.critical).toEqual(["wrong_date"]);
  });

  it("accepte une question « autre » pour une demande hors sujet, et refuse une séance inventée", () => {
    const offTopic: E2eCase = {
      ...test,
      expect: { ...test.expect, mustAsk: { reason: "off_topic" }, critical: ["added_exercise"] },
    };
    expect(scoreCase(offTopic, asked("other")).passed).toBe(true);
    expect(scoreCase(offTopic, asked("off_topic")).passed).toBe(true);
    expect(scoreCase(offTopic, answered(cotes)).critical).toEqual(["added_exercise"]);
  });
});

describe("notation d'une paire", () => {
  const pair = (id: string) => examplePairs.pairs.pairs.find((entry) => entry.id === id)!;

  it("note le premier choix, les trois propositions et le faux positif", () => {
    const rdl = pair("PX-02");
    expect(scorePair(rdl, { first: catalog("romanian-deadlift"), proposals: [], toVerify: false })).toEqual({
      top1: true,
      top3: true,
      falsePositive: false,
    });
    // Pas choisie, mais proposée parmi les trois premières.
    expect(
      scorePair(rdl, {
        first: null,
        proposals: [catalog("deadlift"), catalog("romanian-deadlift"), catalog("single-leg-rdl")],
        toVerify: false,
      }),
    ).toEqual({ top1: false, top3: true, falsePositive: false });
    // Quatrième : trop loin.
    expect(
      scorePair(rdl, {
        first: catalog("deadlift"),
        proposals: [catalog("sumo-deadlift"), catalog("single-leg-rdl"), catalog("romanian-deadlift")],
        toVerify: false,
      }),
    ).toEqual({ top1: false, top3: false, falsePositive: false });
    expect(
      scorePair(pair("PX-06"), {
        first: { kind: "private", name: "Tirage Élastique maison" },
        proposals: [],
        toVerify: false,
      }).top1,
    ).toBe(true);
  });

  it("tient toute fiche choisie pour un terme absent pour un faux positif", () => {
    const absent = pair("PX-07");
    expect(scorePair(absent, { first: null, proposals: [catalog("side-plank")], toVerify: false })).toEqual({
      top1: true,
      top3: true,
      falsePositive: false,
    });
    // Même marquée « À vérifier » : une fiche a été choisie.
    expect(scorePair(absent, { first: catalog("side-plank"), proposals: [], toVerify: true })).toEqual({
      top1: false,
      top3: false,
      falsePositive: true,
    });
    // Un emplacement à compléter n'est pas une fiche.
    expect(
      scorePair(absent, { first: { kind: "placeholder", name: "planche Copenhague" }, proposals: [], toVerify: false })
        .falsePositive,
    ).toBe(false);
  });
});

describe("coût", () => {
  it("calcule le coût d'un appel d'après la table des prix", () => {
    // 15 000 jetons d'entrée à 2 $ le million, 500 de sortie à 8 $ le million.
    expect(costOf({ model: "gpt-4.1", inputTokens: 15000, cachedInputTokens: 0, outputTokens: 500 })).toBeCloseTo(
      0.034,
      6,
    );
    // Le nom daté que renvoie le fournisseur, et les jetons en cache au tarif réduit.
    expect(
      costOf({ model: "gpt-4.1-mini-2025-04-14", inputTokens: 10000, cachedInputTokens: 4000, outputTokens: 1000 }),
    ).toBeCloseTo((6000 * 0.4 + 4000 * 0.1 + 1000 * 1.6) / 1e6, 9);
    expect(priceOf("gpt-4.1-2025-04-14")).toEqual(priceOf("gpt-4.1"));
  });

  it("ne devine jamais le prix d'un modèle inconnu", () => {
    expect(priceOf("gpt-4.1-turbo")).toBeNull();
    expect(costOf({ model: "modele-inconnu", inputTokens: 1000, cachedInputTokens: 0, outputTokens: 10 })).toBeNull();
    expect(sumCosts([0.01, null, 0.02])).toBeNull();
    expect(sumCosts([0.01, 0.02])).toBeCloseTo(0.03, 9);
    expect(sumCosts([])).toBe(0);
  });
});

const usage = (costUsd: number | null): StepUsage[] => [
  { step: "model", model: "gpt-4.1", calls: 1, inputTokens: 15000, cachedInputTokens: 0, outputTokens: 500, costUsd },
];
const fabricatedDriver = (costUsd: number | null, calls: string[] = []): E2eDriver => ({
  provider: "openai",
  limits: ["limite fabriquée"],
  async runCase(input) {
    calls.push(input.id);
    // Le pilote ne reçoit jamais les attentes.
    expect(input).not.toHaveProperty("expect");
    return {
      observed: input.id === "EX-01" ? answered(session("2026-11-23", [squat()])) : asked("exercise"),
      timing: { firstEventMs: 100, firstPlanMs: 900, completeMs: 4000 },
      usage: usage(costUsd),
    };
  },
  async runPair(said) {
    calls.push(said);
    return {
      resolution: { first: null, proposals: [], toVerify: false },
      timing: { firstEventMs: 100, firstPlanMs: null, completeMs: 1000 },
      usage: usage(costUsd),
      error: null,
    };
  },
});
const input = (driver: E2eDriver, options: Partial<Parameters<typeof runE2e>[0]["options"]> = {}) => ({
  corpus: { file: "corpus/examples.json", ...examples },
  pairs: { file: "pairs/examples.json", ...examplePairs },
  driver,
  options: { runs: 3, suite: "all" as const, maxCostUsd: null, concurrency: 1, ...options },
  meta: { commit: "abc", model: "gpt-4.1", fastModel: null },
});

describe("lanceur", () => {
  it("s'arrête net quand le coût cumulé dépasse --max-cost", async () => {
    const calls: string[] = [];
    const report = await runE2e(input(fabricatedDriver(0.4, calls), { maxCostUsd: 1 }));
    // 0,40 $, 0,80 $, puis 1,20 $ : le troisième cas dépasse, rien ne démarre après lui.
    expect(calls).toEqual(["EX-01", "EX-02", "EX-03"]);
    expect(report.rows).toHaveLength(3);
    expect(report.stopped).toBe("max_cost");
    expect(report.costUsd).toBeCloseTo(1.2, 9);
    expect(report.complete).toBe(false);
    expect(report.thresholdsHeld).toBe(false);
    expect(report.passed).toBe(false);
    expect(renderSummary(report)).toContain("ARRÊT : le coût cumulé a dépassé --max-cost");
  });

  it("ne dépasse le plafond que des tâches déjà en vol", async () => {
    const calls: string[] = [];
    const report = await runE2e(input(fabricatedDriver(0.6, calls), { maxCostUsd: 1, concurrency: 3 }));
    expect(report.stopped).toBe("max_cost");
    expect(report.rows.length).toBeLessThanOrEqual(3);
  });

  it("s'arrête dès qu'un modèle appelé n'a pas de prix", async () => {
    const report = await runE2e(input(fabricatedDriver(null), { maxCostUsd: 100 }));
    expect(report.stopped).toBe("unknown_price");
    expect(report.rows).toHaveLength(1);
    expect(report.costUsd).toBeNull();
  });

  it("mesure tout sans plafond, note chaque ligne et applique les seuils à chaque passage", async () => {
    const report = await runE2e(input(fabricatedDriver(0.01)));
    expect(report.rows).toHaveLength(3 * (6 + 8));
    expect(report.complete).toBe(true);
    expect(report.runs).toHaveLength(3);
    for (const run of report.runs) {
      // EX-01 juste, EX-06 mal questionné, quatre questions inutiles sur cinq cas sans question attendue.
      expect(run.cases).toMatchObject({ evaluated: 6, passed: 1, mustNotAsk: 5, needlessQuestions: 4 });
      // Aucune fiche choisie : justes pour les deux termes absents, fausses pour les six autres.
      expect(run.pairs).toMatchObject({ evaluated: 8, top1: 2, present: 6, top3: 0, absent: 2, falsePositives: 0 });
      expect(run.usage).toMatchObject({ calls: 14, inputTokens: 14 * 15000, outputTokens: 14 * 500 });
      expect(run.usage.costUsd).toBeCloseTo(0.14, 9);
      expect(run.latency).toMatchObject({ firstEventMedianMs: 100, firstPlanMedianMs: 900, completeMedianMs: 4000 });
      expect(run.ok).toBe(false);
    }
    expect(report.thresholdsHeld).toBe(false);
    expect(report.pipelineLimits).toEqual(["limite fabriquée"]);
    const summary = renderSummary(report);
    expect(summary).toContain("Passage 3 : SEUILS NON TENUS");
    expect(summary).toContain("VERDICT : seuils non tenus.");
    // Le résumé ne recopie aucune consigne.
    for (const test of examples.corpus.cases) expect(summary).not.toContain(test.text);
  });

  it("ne tient une mesure partielle pour qualifiante sous aucun prétexte", async () => {
    const perfect: E2eDriver = {
      ...fabricatedDriver(0),
      runCase: async () => ({
        observed: answered(session("2026-11-23", [squat()])),
        timing: { firstEventMs: 100, firstPlanMs: 900, completeMs: 4000 },
        usage: [],
      }),
    };
    const report = await runE2e(input(perfect, { only: ["EX-01"], suite: "cases" }));
    expect(report.rows).toHaveLength(3);
    expect(report.thresholdsHeld).toBe(true);
    expect(report.complete).toBe(false);
    expect(report.passed).toBe(false);
    expect(renderSummary(report)).toContain("Mesure partielle : elle ne qualifie rien.");
    await expect(runE2e(input(perfect, { only: ["EX-99"] }))).rejects.toThrow("unknown_ids");
    // Un seul passage ne suffit pas non plus.
    expect((await runE2e(input(perfect, { runs: 1 }))).complete).toBe(false);
    // Ni les exemples du README, ni le prestataire simulé, même à trois passages complets.
    const onExamples = await runE2e({ ...input(perfect), meta: { ...input(perfect).meta, examples: true } });
    expect(onExamples).toMatchObject({ examples: true, complete: false, passed: false });
    expect(renderSummary(onExamples)).toContain("EXEMPLES : ces cas montrent le format.");
    const simulated = await runE2e(input({ ...perfect, provider: "fake" }));
    expect(simulated).toMatchObject({ complete: false, passed: false });
    expect(renderSummary(simulated)).toContain("PRESTATAIRE SIMULÉ");
  });
});

describe("seuils", () => {
  const caseRow = (id: string, overrides: Partial<CaseRow["score"]> = {}, completeMs = 4000): CaseRow => ({
    suite: "case",
    run: 1,
    id,
    kind: "described",
    spoken: false,
    mustAsk: false,
    observed: answered(),
    score: {
      passed: true,
      differences: [],
      faults: [],
      critical: [],
      needlessQuestion: false,
      notes: [],
      ...overrides,
    },
    timing: { firstEventMs: 300, firstPlanMs: 1200, completeMs },
    usage: [],
    costUsd: 0,
  });
  const pairRow = (id: string, absent: boolean, overrides: Partial<PairRow["score"]> = {}): PairRow => ({
    suite: "pair",
    run: 1,
    id,
    absent,
    resolution: { first: null, proposals: [], toVerify: false },
    score: { top1: true, top3: true, falsePositive: false, ...overrides },
    timing: { firstEventMs: null, firstPlanMs: null, completeMs: 1000 },
    usage: [],
    costUsd: 0,
    error: null,
  });
  const cases = (failed: number, needless = 0) =>
    Array.from({ length: 100 }, (_, i) =>
      caseRow(`C${i}`, i < failed ? { passed: false, differences: ["reps"], needlessQuestion: i < needless } : {}),
    );
  const pairs = (wrong: number, falsePositives = 0) => [
    ...Array.from({ length: 100 }, (_, i) => pairRow(`P${i}`, false, i < wrong ? { top1: false } : {})),
    ...Array.from({ length: 100 }, (_, i) =>
      pairRow(`A${i}`, true, i < falsePositives ? { top1: false, top3: false, falsePositive: true } : {}),
    ),
  ];
  const verdict = (rows: (CaseRow | PairRow)[]) => {
    const [run] = summarize(rows);
    return Object.fromEntries(run!.thresholds.map((v) => [v.key, v.ok]));
  };

  it("porte les seuils décidés le 21 novembre 2026", () => {
    expect(E2E_THRESHOLDS).toEqual({
      criticalFaults: 0,
      caseAccuracy: 0.95,
      needlessQuestionRate: 0.02,
      pairTop1Accuracy: 0.97,
      absentFalsePositiveRate: 0.01,
      firstEventMedianMs: 2000,
      completeMedianMs: 15000,
    });
  });

  it("tient à la limite et échoue juste au-delà", () => {
    // 95 % de cas justes, 2 % de questions inutiles, 97 % de premier choix sur 200 paires, 1 % de faux positifs.
    const held = summarize([...cases(5, 2), ...pairs(5, 1)])[0]!;
    expect(held.ok).toBe(true);
    expect(held.thresholds.every((v) => v.ok === true)).toBe(true);
    expect(verdict([...cases(6, 2), ...pairs(5, 1)]).caseAccuracy).toBe(false);
    expect(verdict([...cases(5, 3), ...pairs(5, 1)]).needlessQuestionRate).toBe(false);
    expect(verdict([...cases(5, 2), ...pairs(7, 0)]).pairTop1Accuracy).toBe(false);
    expect(verdict([...cases(5, 2), ...pairs(0, 2)]).absentFalsePositiveRate).toBe(false);
  });

  it("échoue à la première faute grave", () => {
    const rows = [...cases(0), ...pairs(0)];
    (rows[0] as CaseRow).score = {
      passed: false,
      differences: ["wrong_date"],
      faults: ["wrong_date"],
      critical: ["wrong_date"],
      needlessQuestion: false,
      notes: [],
    };
    const [run] = summarize(rows);
    expect(run!.cases.criticalCases).toEqual([{ id: "C0", faults: ["wrong_date"] }]);
    expect(verdict(rows).criticalFaults).toBe(false);
    expect(run!.ok).toBe(false);
  });

  it("exige une médiane strictement sous 2 s et 15 s", () => {
    const at = (firstEventMs: number, completeMs: number) =>
      checkThresholds({
        criticalFaults: 0,
        caseAccuracy: 1,
        needlessQuestionRate: 0,
        pairTop1Accuracy: 1,
        absentFalsePositiveRate: 0,
        firstEventMedianMs: firstEventMs,
        completeMedianMs: completeMs,
      }).filter((v) => v.ok === false);
    expect(at(1999, 14999)).toEqual([]);
    expect(at(2000, 14999).map((v) => v.key)).toEqual(["firstEventMedianMs"]);
    expect(at(1999, 15000).map((v) => v.key)).toEqual(["completeMedianMs"]);
    expect(median([1, 9, 3])).toBe(3);
    expect(median([1, 3, 5, 9])).toBe(4);
    expect(median([])).toBeNull();
  });

  it("applique les seuils à chaque passage, pas à leur moyenne", () => {
    const second = cases(20).map((row) => ({ ...row, run: 2 }));
    const runs = summarize([...cases(0), ...pairs(0), ...second]);
    expect(runs.map((run) => run.ok)).toEqual([true, false]);
    // Un passage sans paire ne les tient pas pour justes : non mesuré.
    expect(runs[1]!.thresholds.find((v) => v.key === "pairTop1Accuracy")!.ok).toBeNull();
  });

  it("ne laisse pas une panne rapide flatter la latence", () => {
    const failure: CaseRow = {
      ...caseRow("X", { passed: false, differences: ["error"] }, 5),
      observed: { status: "error", blocked: false, questions: [], sessions: [], error: "planner_timeout" },
    };
    const [run] = summarize([caseRow("A", {}, 4000), caseRow("B", {}, 6000), failure]);
    expect(run!.latency.completeMedianMs).toBe(5000);
    expect(run!.cases.errors).toBe(1);
  });
});

describe("gel du corpus", () => {
  const copy = () => {
    const dir = mkdtempSync(path.join(tmpdir(), "tartan-e2e-"));
    const file = path.join(dir, "cases.json");
    copyFileSync(examplesFile, file);
    copyFileSync(`${examplesFile}.sha256`, `${file}.sha256`);
    return file;
  };
  const code = (run: () => unknown) => {
    try {
      run();
    } catch (error) {
      return error instanceof FreezeError ? error.code : "autre";
    }
    return "accepté";
  };

  it("charge les exemples gelés, corpus et paires", () => {
    expect(examples.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(readFileSync(`${examplesFile}.sha256`, "utf8")).toBe(`${examples.hash}  examples.json\n`);
    expect(examplePairs.pairs.pairs).toHaveLength(8);
  });

  it("refuse un corpus modifié après son gel", () => {
    const file = copy();
    expect(code(() => loadFrozenCorpus(file))).toBe("accepté");
    writeFileSync(file, readFileSync(file, "utf8").replace('"reps": 8', '"reps": 9'));
    expect(code(() => loadFrozenCorpus(file))).toBe("frozen_corpus_changed");
    // Regeler par-dessus est refusé aussi : l'ancienne empreinte se retire à la main.
    expect(code(() => freezeFile(file))).toBe("already_frozen");
  });

  it("refuse un corpus jamais gelé, absent, ou gelé mais invalide", () => {
    const file = copy();
    const unfrozen = path.join(path.dirname(file), "neuf.json");
    copyFileSync(file, unfrozen);
    expect(code(() => loadFrozenCorpus(unfrozen))).toBe("not_frozen");
    expect(code(() => loadFrozenCorpus(path.join(path.dirname(file), "absent.json")))).toBe("missing_file");
    // Une clé qui n'est pas dans le catalogue commun.
    const wrongKey = path.join(path.dirname(file), "cle.json");
    writeFileSync(wrongKey, readFileSync(file, "utf8").replace('"key": "back-squat"', '"key": "squat-inconnu"'));
    freezeFile(wrongKey);
    expect(code(() => loadFrozenCorpus(wrongKey))).toBe("invalid");
    expect(freezeFile(unfrozen)).toBe(examples.hash);
    expect(code(() => loadFrozenCorpus(unfrozen))).toBe("accepté");
  });
});

describe("options de la commande", () => {
  it("lit les options demandées", () => {
    expect(
      parseOptions(["--runs", "2", "--model", "gpt-4.1", "--fast-model", "gpt-4.1-mini", "--only", "EX-01, EX-03"]),
    ).toMatchObject({
      action: "run",
      runs: 2,
      model: "gpt-4.1",
      fastModel: "gpt-4.1-mini",
      only: ["EX-01", "EX-03"],
      maxCostUsd: null,
      suite: "all",
    });
    expect(parseOptions([])).toMatchObject({ runs: 3, concurrency: 3, examples: false });
    expect(parseOptions(["--max-cost", "7.5"]).maxCostUsd).toBe(7.5);
    expect(parseOptions(["--summary", ".local/rapport.json"])).toMatchObject({
      action: "summary",
      summary: ".local/rapport.json",
    });
    expect(parseOptions(["--freeze", "--examples"])).toMatchObject({ action: "freeze", examples: true });
  });

  it("refuse une option inconnue, une valeur absente ou un montant nul", () => {
    for (const argv of [["--live"], ["--runs"], ["--runs", "0"], ["--max-cost", "0"], ["--suite", "tout"]])
      expect(() => parseOptions(argv)).toThrow(OptionError);
    expect(() => parseOptions(["--check", "--freeze"])).toThrow(OptionError);
  });

  it("n'accepte qu'une base locale et dédiée à la mesure", () => {
    expect(assertEvalDatabase("postgresql://tartan@localhost:54329/tartan_ia_mesure_eval")).toContain("_eval");
    for (const url of [
      "postgresql://tartan@localhost:54329/tartan",
      "postgresql://tartan@localhost:54329/tartan_test",
      "postgresql://user@db.example.com/tartan_eval",
      "pas une adresse",
    ])
      expect(() => assertEvalDatabase(url)).toThrow(OptionError);
  });
});
