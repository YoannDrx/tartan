// Le compteur d'appels et de jetons, sur le chemin réel du service : l'adaptateur OpenAI, sa réponse diffusée, puis le
// coût et l'arrêt au budget. Le réseau est remplacé par une réponse fabriquée : aucun appel ne sort du poste.
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { caseInput } from "../evals/e2e/format";
import { loadFrozenCorpus } from "../evals/e2e/freeze";
import { runE2e } from "../evals/e2e/runner";

// Avant tout import du service : une clé factice, jamais envoyée, et pas de prestataire simulé.
const restoreEnv = vi.hoisted(() => {
  const names = ["AI_PLANNER_ENABLED", "AI_PLANNER_MODEL", "OPENAI_API_KEY", "AI_PLANNER_FAKE_PROVIDER", "VERCEL"];
  const before = names.map((name) => [name, process.env[name]] as const);
  process.env.AI_PLANNER_ENABLED = "true";
  process.env.AI_PLANNER_MODEL = "gpt-4.1";
  process.env.OPENAI_API_KEY = "cle-factice-de-test-jamais-envoyee";
  delete process.env.AI_PLANNER_FAKE_PROVIDER;
  delete process.env.VERCEL;
  return () => {
    for (const [name, value] of before)
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
  };
});

const answer = {
  status: "clarification",
  questions: [{ id: "repos", field: "rest", question: "Quelle récupération ?", exerciseName: null, options: [] }],
  sessions: [],
  assumptions: [],
  suggestions: [],
};
const completed = {
  model: "gpt-4.1-2025-04-14",
  status: "completed",
  output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(answer) }] }],
  usage: { input_tokens: 15000, output_tokens: 500, input_tokens_details: { cached_tokens: 5000 } },
};
const requests: { url: string; model: string; stream: boolean }[] = [];
// Ce que le fournisseur répondrait : diffusé quand le service le demande, d'une seule pièce sinon.
const canned: typeof fetch = async (input, init) => {
  const url = String(input);
  if (!url.startsWith("https://api.openai.com/")) throw new Error("réseau interdit dans ce test");
  const body = JSON.parse(String(init?.body)) as { model: string; stream?: boolean };
  requests.push({ url, model: body.model, stream: Boolean(body.stream) });
  if (!body.stream) return Response.json(completed);
  const events = [
    { type: "response.output_text.delta", delta: JSON.stringify(answer) },
    { type: "response.completed", response: completed },
  ];
  return new Response(events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), {
    headers: { "Content-Type": "text/event-stream" },
  });
};
vi.stubGlobal("fetch", canned);

const { createServiceDriver } = await import("../evals/e2e/driver");
const file = path.resolve(import.meta.dirname, "../evals/e2e/corpus/examples.json");
const corpus = { file: "corpus/examples.json", ...loadFrozenCorpus(file) };
const driver = createServiceDriver();
afterAll(() => {
  driver.close();
  vi.unstubAllGlobals();
  restoreEnv();
});

// 10 000 jetons d'entrée à 2 $ le million, 5 000 en cache à 0,50 $, 500 de sortie à 8 $.
const COST = (10000 * 2 + 5000 * 0.5 + 500 * 8) / 1e6;

describe("compteur d'appels sur le chemin réel du service", () => {
  it("compte l'appel diffusé de l'adaptateur, ses jetons, son étape et son coût", async () => {
    expect(driver.provider).toBe("openai");
    // Le compteur rend `fetch` tel qu'il l'a trouvé, sans l'avoir remplacé pour de bon.
    expect(globalThis.fetch).not.toBe(canned);
    const outcome = await driver.runCase(caseInput(corpus.corpus.cases.find((test) => test.id === "EX-01")!));
    // Comme pour l'écran : le service demande une réponse diffusée, au modèle configuré.
    expect(requests).toEqual([{ url: "https://api.openai.com/v1/responses", model: "gpt-4.1", stream: true }]);
    expect(outcome.observed).toMatchObject({
      status: "question",
      blocked: true,
      questions: [{ reason: "rest", exerciseName: null }],
    });
    expect(outcome.usage).toHaveLength(1);
    expect(outcome.usage[0]).toMatchObject({
      step: "model",
      model: "gpt-4.1-2025-04-14",
      calls: 1,
      inputTokens: 15000,
      cachedInputTokens: 5000,
      outputTokens: 500,
    });
    expect(outcome.usage[0]!.costUsd).toBeCloseTo(COST, 9);
    expect(outcome.timing.firstEventMs).not.toBeNull();
    expect(outcome.timing.completeMs).toBeGreaterThan(0);
  }, 60_000);

  it("arrête la mesure dès que le coût compté dépasse le plafond", async () => {
    requests.length = 0;
    const report = await runE2e({
      corpus,
      pairs: null,
      driver,
      options: { runs: 3, suite: "cases", only: ["EX-01", "EX-02"], maxCostUsd: COST * 1.5, concurrency: 1 },
      meta: { commit: null, model: "gpt-4.1", fastModel: null },
    });
    // Deux cas, deux appels : le second fait dépasser, les passages suivants ne démarrent pas.
    expect(requests).toHaveLength(2);
    expect(report.rows).toHaveLength(2);
    expect(report.stopped).toBe("max_cost");
    expect(report.costUsd).toBeCloseTo(COST * 2, 9);
    expect(report.runs[0]!.usage).toMatchObject({ calls: 2, inputTokens: 30000, cachedInputTokens: 10000 });
    expect(report.runs[0]!.usage.steps).toMatchObject([{ step: "model", model: "gpt-4.1-2025-04-14", calls: 2 }]);
    expect(report.thresholdsHeld).toBe(false);
  }, 60_000);
});
