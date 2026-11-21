// Le corpus du fondateur : 40 consignes écrites et 30 dictées, hors dépôt (.local/planner-founder/).
// Sans --live, rien ne part sur le réseau : la commande vérifie le corpus et n'affiche que des comptes, des
// empreintes et des problèmes nommés par identifiant, jamais une consigne. --freeze fige le corpus avant toute
// mesure. --live (avec --confirm-cost) appelle OpenAI : réservé au fondateur, avec une clé plafonnée.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import dotenv from "dotenv";
import {
  checkFounderCorpus,
  dictationAsCase,
  DICTATIONS_DIR,
  FOUNDER_COUNTS,
  FOUNDER_DIR,
  FOUNDER_THRESHOLDS,
  freezeFounderCorpus,
  wordErrorRate,
} from "../evals/planner-founder";
import { independentContext, scoreIndependentCase } from "../evals/planner-independent";

const option = (name: string) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};

type Row = {
  kind: "instruction" | "dictation";
  id: string;
  run: number;
  passed: boolean;
  differences: string[];
  critical: string[];
  wordErrorRate?: number;
  error?: string;
  durationMs: number;
};

async function main() {
  const root = resolve(import.meta.dirname, "../../..");
  const dir = resolve(root, option("--dir") ?? FOUNDER_DIR);
  const check = checkFounderCorpus(dir);
  // Le contrôle hors réseau d'abord, toujours : il suffit pour aider le fondateur sans lire ses consignes.
  console.log(
    JSON.stringify({
      expected: FOUNDER_COUNTS,
      instructions: check.instructions,
      dictations: check.dictations,
      problems: check.problems,
      providerCalls: 0,
    }),
  );
  if (process.argv.includes("--freeze")) {
    freezeFounderCorpus(dir, check);
    console.log(JSON.stringify({ frozen: true }));
    return;
  }
  if (!process.argv.includes("--live")) {
    if (check.problems.length) process.exitCode = 1;
    return;
  }
  if (!process.argv.includes("--confirm-cost")) throw new Error("confirm_cost_required");
  if (check.problems.length || !check.corpus || !check.manifest) throw new Error("corpus_invalid");
  if (!check.instructions?.frozen || !check.dictations?.frozen) throw new Error("corpus_not_frozen");

  const localPath = resolve(root, ".env.local");
  const local = existsSync(localPath) ? dotenv.parse(readFileSync(localPath)) : {};
  const key = process.env.OPENAI_API_KEY || local.OPENAI_API_KEY;
  if (!key) throw new Error("missing_key");
  const model = process.env.AI_PLANNER_MODEL || local.AI_PLANNER_MODEL || "gpt-6.2-sol";
  Object.assign(process.env, {
    OPENAI_API_KEY: key,
    AI_PLANNER_MODEL: model,
    AI_PLANNER_ENABLED: "true",
    DATABASE_URL: "postgresql://tartan@localhost:54329/tartan_eval_unused",
    DATABASE_URL_UNPOOLED: "postgresql://tartan@localhost:54329/tartan_eval_unused",
    BETTER_AUTH_SECRET: "synthetic-planner-evaluation-local-only-secret",
    BETTER_AUTH_URL: "http://localhost:3102",
    NEXT_PUBLIC_APP_URL: "http://localhost:3102",
  });
  // Chargés après les variables : le prestataire lit l'environnement à l'import.
  const { openAiPlannerProvider, PlannerProviderError } = await import("../src/server/ai/provider");
  const { interpretPlannerContext } = await import("../src/server/ai/pipeline");
  const { openAiTranscriptionProvider } = await import("../src/server/ai/transcription-provider");
  const { inspectPlannerAudio } = await import("../src/server/ai/audio");

  const output = resolve(root, option("--output") ?? `.local/planner-founder-${Date.now()}.json`);
  if (existsSync(output)) throw new Error("output_exists");
  mkdirSync(dirname(output), { recursive: true });
  const report = {
    model,
    commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    instructionsHash: check.instructions.hash,
    dictationsHash: check.dictations.hash,
    createdAt: new Date().toISOString(),
    thresholds: FOUNDER_THRESHOLDS,
    rows: [] as Row[],
  };
  const save = () => {
    writeFileSync(`${output}.tmp`, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    renameSync(`${output}.tmp`, output);
  };
  const provider = openAiPlannerProvider();
  const errorCode = (cause: unknown) => (cause instanceof PlannerProviderError ? cause.code : "local_error");

  for (let run = 1; run <= FOUNDER_THRESHOLDS.runs; run += 1)
    for (const test of check.corpus.cases) {
      const started = Date.now();
      const row: Row = { kind: "instruction", id: test.id, run, passed: false, differences: [], critical: [], durationMs: 0 };
      try {
        const score = scoreIndependentCase(test, await interpretPlannerContext(independentContext(test, check.corpus), provider), check.corpus);
        Object.assign(row, { passed: score.passed, differences: score.differences, critical: score.critical });
      } catch (cause) {
        row.error = errorCode(cause);
      }
      row.durationMs = Date.now() - started;
      report.rows.push(row);
      save();
      console.log(JSON.stringify({ kind: row.kind, run, id: row.id, passed: row.passed, critical: row.critical, error: row.error }));
    }

  // Une passe pour les dictées : la transcription, puis la même notation que l'écrit.
  const transcriber = openAiTranscriptionProvider();
  const manifestCorpus = { ...check.manifest, cases: [] };
  for (const entry of check.manifest.cases) {
    const started = Date.now();
    const row: Row = { kind: "dictation", id: entry.id, run: 1, passed: false, differences: [], critical: [], durationMs: 0 };
    try {
      const bytes = new Uint8Array(readFileSync(join(dir, DICTATIONS_DIR, entry.file)));
      const transcript = await transcriber.transcribe(await inspectPlannerAudio(bytes));
      row.wordErrorRate = Math.round(wordErrorRate(entry.spoken, transcript) * 1000) / 1000;
      const test = dictationAsCase(entry);
      const context = independentContext({ ...test, text: transcript }, manifestCorpus);
      const score = scoreIndependentCase(test, await interpretPlannerContext(context, provider), manifestCorpus);
      Object.assign(row, { passed: score.passed, differences: score.differences, critical: score.critical });
    } catch (cause) {
      row.error = errorCode(cause);
    }
    row.durationMs = Date.now() - started;
    report.rows.push(row);
    save();
    console.log(JSON.stringify({ kind: row.kind, id: row.id, passed: row.passed, wordErrorRate: row.wordErrorRate, error: row.error }));
  }

  const instructionRuns = Array.from({ length: FOUNDER_THRESHOLDS.runs }, (_, i) =>
    report.rows.filter((row) => row.kind === "instruction" && row.run === i + 1 && row.passed).length,
  );
  const dictations = report.rows.filter((row) => row.kind === "dictation");
  const rates = dictations.map((row) => row.wordErrorRate ?? 1).sort((a, b) => a - b);
  const median = rates[Math.floor(rates.length / 2)] ?? 1;
  const critical = report.rows.filter((row) => row.critical.length).map((row) => `${row.kind}:${row.id}`);
  const qualified =
    instructionRuns.every((passed) => passed >= FOUNDER_THRESHOLDS.instructionsPassedPerRun) &&
    dictations.filter((row) => row.passed).length >= FOUNDER_THRESHOLDS.dictationsPassed &&
    median <= FOUNDER_THRESHOLDS.medianWordErrorRate &&
    critical.length <= FOUNDER_THRESHOLDS.criticalAllowed;
  console.log(JSON.stringify({ instructionRuns, dictationsPassed: dictations.filter((row) => row.passed).length, medianWordErrorRate: median, critical, qualified, humanReview: "pending" }));
  if (!qualified) process.exitCode = 1;
}

main().catch((cause: unknown) => {
  console.error(
    `Founder planner evaluation stopped: ${cause instanceof Error ? cause.message : "unknown"}. No credentials or provider body logged.`,
  );
  process.exitCode = 1;
});
