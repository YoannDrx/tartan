// Passage complet du lanceur par le service, contre le prestataire simulé : un espace jetable par cas dans la base
// de test, `createPlannerProposal`, les brouillons préparés, puis la notation. Aucun appel réel.
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { loadFrozenCorpus, loadFrozenPairs } from "../evals/e2e/freeze";
import { renderSummary, type CaseRow, type PairRow } from "../evals/e2e/report";
import { runE2e } from "../evals/e2e/runner";

// Avant tout import du service : il lit l'environnement une seule fois.
const restoreEnv = vi.hoisted(() => {
  const names = ["AI_PLANNER_ENABLED", "AI_PLANNER_FAKE_PROVIDER", "OPENAI_API_KEY", "OPEN_AI_API_KEY", "VERCEL"];
  const before = names.map((name) => [name, process.env[name]] as const);
  process.env.AI_PLANNER_ENABLED = "true";
  process.env.AI_PLANNER_FAKE_PROVIDER = "true";
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPEN_AI_API_KEY;
  delete process.env.VERCEL;
  return () => {
    for (const [name, value] of before)
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
  };
});

const { createServiceDriver, legacyBrief, readProviderUsage, usageOf } = await import("../evals/e2e/driver");
const folder = path.resolve(import.meta.dirname, "../evals/e2e");
const corpus = { file: "corpus/examples.json", ...loadFrozenCorpus(path.join(folder, "corpus/examples.json")) };
const pairs = { file: "pairs/examples.json", ...loadFrozenPairs(path.join(folder, "pairs/examples.json")) };
const driver = createServiceDriver();
afterAll(() => {
  driver.close();
  restoreEnv();
});

describe("mesure de bout en bout par le service", () => {
  it("déroule les six exemples et les paires jusqu'aux brouillons préparés", async () => {
    const report = await runE2e({
      corpus,
      pairs,
      driver,
      options: { runs: 1, suite: "all", maxCostUsd: null, concurrency: 2 },
      meta: { commit: null, model: "simulé", fastModel: null },
    });
    expect(report.provider).toBe("fake");
    expect(report.rows).toHaveLength(6 + 8);
    const row = (id: string) => report.rows.find((entry) => entry.id === id) as CaseRow;
    const pair = (id: string) => report.rows.find((entry) => entry.id === id) as PairRow;
    // Aucune panne : chaque cas a traversé l'espace créé, le service et la notation.
    expect(report.rows.filter((entry) => entry.suite === "case" && entry.observed.status === "error")).toEqual([]);
    expect(report.rows.filter((entry) => entry.suite === "pair" && entry.error)).toEqual([]);

    // EX-01 : la fiche de l'espace représente la fiche du catalogue, la prescription vient des brouillons.
    const first = row("EX-01");
    expect(first.observed).toMatchObject({ status: "sessions", blocked: false });
    expect(first.observed.sessions[0]).toMatchObject({
      date: "2026-11-23",
      recipients: { groups: ["Sprint"], athletes: [] },
    });
    expect(first.observed.sessions[0]!.steps).toMatchObject([
      {
        type: "movement",
        ref: { kind: "catalog", key: "back-squat" },
        sets: 3,
        reps: 8,
        restS: 90,
        load: null,
        family: "strength",
        equipment: ["barbell", "rack"],
      },
    ]);
    expect(first.score).toMatchObject({ passed: true, differences: [], critical: [] });
    expect(first.legacy).toMatchObject({ mode: "format", period: { from: "2026-11-23", to: "2026-11-29" } });
    // Les événements diffusés ont été écoutés : étape d'abord, plan ensuite, brouillons à la fin.
    expect(first.timing.firstEventMs).toBeGreaterThanOrEqual(0);
    expect(first.timing.firstPlanMs!).toBeGreaterThanOrEqual(first.timing.firstEventMs!);
    expect(first.timing.completeMs).toBeGreaterThanOrEqual(first.timing.firstPlanMs!);

    // EX-02 : les tours du prestataire simulé arrivent en groupe, par la séquence du brouillon.
    expect(row("EX-02").observed.sessions[0]!.steps[0]).toMatchObject({
      type: "group",
      rounds: 3,
      restBetweenRoundsS: 60,
    });
    expect(row("EX-02").score.passed).toBe(false);

    // EX-04 : le mode « Proposer » est déduit de la nature du cas, son brief de la consigne et de l'espace.
    expect(row("EX-04").legacy).toMatchObject({
      mode: "propose",
      brief: { date: "2026-11-26", durationMin: 40, level: "intermediate", equipment: ["bodyweight"] },
      assumed: ["level"],
    });
    expect(row("EX-04").observed.sessions[0]).toMatchObject({ date: "2026-11-26", durationMin: 40 });
    // EX-05 : un athlète seul, choisi hors de son groupe.
    expect(row("EX-05").observed.sessions[0]!.recipients).toEqual({ groups: [], athletes: ["Lina Morel"] });

    // Paires : une fiche du catalogue, une fiche privée, et un terme absent laissé sans fiche.
    expect(pair("PX-01").resolution.first).toEqual({ kind: "catalog", key: "back-squat" });
    expect(pair("PX-06").resolution.first).toEqual({ kind: "private", name: "Tirage élastique maison" });
    expect(pair("PX-06").score.top1).toBe(true);
    expect(pair("PX-07")).toMatchObject({ absent: true, score: { top1: true, falsePositive: false } });

    // Prestataire simulé : aucun appel, aucun jeton, aucun coût.
    const [run] = report.runs;
    expect(run!.usage).toMatchObject({ calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, steps: [] });
    expect(report.costUsd).toBe(0);
    expect(run!.cases).toMatchObject({ evaluated: 6, errors: 0 });
    expect(run!.cases.passed).toBeGreaterThanOrEqual(1);
    expect(run!.pairs.evaluated).toBe(8);
    expect(run!.latency.completeMedianMs).toBeGreaterThan(0);
    // Le prestataire simulé ne tient pas les seuils, et un seul passage ne qualifie rien.
    expect(report.thresholdsHeld).toBe(false);
    expect(report.complete).toBe(false);
    expect(report.pipelineLimits.length).toBeGreaterThan(0);
    const summary = renderSummary(report);
    expect(summary).toContain("Prestataire : simulé (aucun appel réel)");
    expect(summary).toContain("Passage 1 : SEUILS NON TENUS");
    expect(summary).toContain("Limites du pipeline mesuré :");
  }, 120_000);

  it("refuse tout appel vers le fournisseur tant que le prestataire est simulé", async () => {
    await expect(fetch("https://api.openai.com/v1/responses", { method: "POST", body: "{}" })).rejects.toThrow(
      "e2e_eval_network_blocked",
    );
  });
});

describe("lecture des jetons du fournisseur", () => {
  it("lit une réponse d'une seule pièce", () => {
    const body = {
      model: "gpt-4.1-2025-04-14",
      usage: { input_tokens: 15230, output_tokens: 480, input_tokens_details: { cached_tokens: 12000 } },
    };
    expect(readProviderUsage(JSON.stringify(body))).toEqual({
      model: "gpt-4.1-2025-04-14",
      inputTokens: 15230,
      cachedInputTokens: 12000,
      outputTokens: 480,
    });
  });

  it("lit la fin d'une réponse diffusée, et rien quand les jetons manquent", () => {
    const stream = [
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"{"}',
      'event: response.completed\ndata: {"type":"response.completed","response":{"model":"gpt-4.1-mini","status":"completed","usage":{"input_tokens":900,"output_tokens":120}}}',
    ].join("\n\n");
    expect(readProviderUsage(stream)).toEqual({
      model: "gpt-4.1-mini",
      inputTokens: 900,
      cachedInputTokens: 0,
      outputTokens: 120,
    });
    expect(readProviderUsage('data: {"type":"response.output_text.delta","delta":"x"}')).toBeNull();
    expect(readProviderUsage("pas du JSON")).toBeNull();
  });

  it("range les appels par étape et par modèle, avec leur coût", () => {
    const call = (step: string, model: string) => ({
      step,
      model,
      inputTokens: 10000,
      cachedInputTokens: 0,
      outputTokens: 1000,
    });
    const usage = usageOf([call("model", "gpt-4.1"), call("retry", "gpt-4.1"), call("model", "gpt-4.1")]);
    expect(usage).toHaveLength(2);
    expect(usage[0]).toMatchObject({ step: "model", calls: 2, inputTokens: 20000, outputTokens: 2000 });
    expect(usage[0]!.costUsd).toBeCloseTo(2 * 0.028, 9);
    expect(usage[1]).toMatchObject({ step: "retry", calls: 1 });
    expect(usageOf([call("model", "modele-sans-prix")])[0]!.costUsd).toBeNull();
  });
});

describe("brief déduit pour le pipeline actuel", () => {
  const period = { from: "2026-11-23", to: "2026-11-29" };
  const brief = (text: string, equipment?: ("barbell" | "bench")[]) =>
    legacyBrief({ text, today: "2026-11-23", ...(equipment ? { space: { equipment } } : {}) }, period);

  it("lit le jour, la durée et le niveau dans la consigne, le matériel dans l'espace", () => {
    expect(brief("Vendredi, force du bas du corps, 1 h 15, athlètes confirmés.", ["barbell", "bench"])).toEqual({
      brief: {
        objective: "Vendredi, force du bas du corps, 1 h 15, athlètes confirmés.",
        date: "2026-11-27",
        durationMin: 75,
        level: "advanced",
        equipment: ["barbell", "bench"],
      },
      assumed: [],
    });
    expect(brief("demain une séance de gainage de 25 minutes pour débutants").brief).toMatchObject({
      date: "2026-11-24",
      durationMin: 25,
      level: "beginner",
      equipment: [],
    });
  });

  it("note ce qu'il a dû supposer, sans rien prendre aux attentes", () => {
    expect(brief("Une séance de vitesse pour le groupe.")).toMatchObject({
      brief: { date: "2026-11-23", durationMin: 60, level: "intermediate" },
      assumed: ["date", "durationMin", "level"],
    });
  });
});
