// Évaluation hors base, sur des consignes fictives versionnées uniquement.
// Sans --live : validation du corpus, aucun chargement de clé ni appel prestataire.
import { readFileSync, existsSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import dotenv from "dotenv";
import { plannerCorpus, corpusContext } from "../evals/planner-corpus";
import { scorePlannerCase, type PlannerScore } from "../evals/planner-score";
import { openAiPlannerProvider, plannerProviderContext, PlannerProviderError } from "../src/server/ai/provider";
import type { PlannerInterpretation } from "@tartan/contracts";

type CaseResult = {
  id: string;
  at: string;
  durationMs: number;
  result?: PlannerInterpretation;
  error?: string;
  score?: PlannerScore;
  coachCorrections: number | null;
  humanAudio: null;
  // Réponse brute uniquement des scénarios fictifs, pour diagnostiquer un refus
  // du contrat sans journaliser les consignes privées de l'application.
  providerText?: string;
};
type Report = {
  signature: string;
  corpusHash: string;
  implementationHash: string;
  model: string;
  commit: string;
  dirty: boolean;
  createdAt: string;
  cases: CaseResult[];
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
async function main() {
  for (const test of plannerCorpus)
    plannerProviderContext.parse({
      ...corpusContext,
      targets: test.targets ?? corpusContext.targets,
      instructions: test.instructions,
    });
  if (new Set(plannerCorpus.map((c) => c.id)).size !== plannerCorpus.length) throw new Error("duplicate_case");
  const ids = arg("--ids")?.split(",");
  if (ids?.some((id) => !plannerCorpus.some((c) => c.id === id))) throw new Error("unknown_case");
  const selected = ids ? plannerCorpus.filter((c) => ids.includes(c.id)) : plannerCorpus;
  if (!process.argv.includes("--live")) {
    console.log(
      JSON.stringify({
        mode: "validate-only",
        cases: plannerCorpus.length,
        selected: selected.length,
        audioScripts: plannerCorpus.filter((c) => c.audioScript).length,
        humanRecordings: 0,
        providerCalls: 0,
      }),
    );
    return;
  }
  // Reprise de la clé existante autorisée par le fondateur ; aucune valeur n'est affichée.
  const root = resolve(import.meta.dirname, "../../..");
  const localPath = resolve(root, ".env.local");
  const local = existsSync(localPath) ? dotenv.parse(readFileSync(localPath)) : {};
  const key =
    process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY || local.OPENAI_API_KEY || local.OPEN_AI_API_KEY;
  if (!key) throw new Error("missing_key");
  const model = process.env.AI_PLANNER_MODEL || local.AI_PLANNER_MODEL || "gpt-4.1-mini";
  process.env.OPENAI_API_KEY = key;
  process.env.AI_PLANNER_MODEL = model;
  process.env.AI_PLANNER_ENABLED = "true";
  process.env.DATABASE_URL = "postgresql://tartan@localhost:54329/tartan_eval_unused";
  process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;
  process.env.BETTER_AUTH_SECRET = "synthetic-planner-evaluation-local-only-secret";
  process.env.BETTER_AUTH_URL = "http://localhost:3102";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3102";
  const corpusHash = hash(JSON.stringify({ corpusContext, plannerCorpus }));
  const implementationHash = hash(
    [
      "apps/web/src/server/ai/provider.ts",
      "packages/domain/src/ai-planner.ts",
      "packages/domain/src/exercise-aliases.ts",
      "packages/domain/src/planner-guards.ts",
      "packages/contracts/src/ai-planner.ts",
      "apps/web/evals/planner-score.ts",
      "apps/web/scripts/planner-eval.ts",
    ]
      .map((p) => readFileSync(resolve(root, p), "utf8"))
      .join("\n"),
  );
  const signature = hash(`${corpusHash}:${implementationHash}:${model}`);
  const resume = arg("--resume");
  const path = resolve(root, resume ?? arg("--output") ?? `.local/planner-eval-${Date.now()}.json`);
  if (!resume && existsSync(path)) throw new Error("output_exists_use_resume");
  const report: Report = resume
    ? JSON.parse(readFileSync(path, "utf8"))
    : {
        signature,
        corpusHash,
        implementationHash,
        model,
        commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
        dirty:
          Boolean(execFileSync("git", ["diff", "--name-only"], { cwd: root, encoding: "utf8" }).trim()) ||
          Boolean(
            execFileSync(
              "git",
              ["ls-files", "--others", "--exclude-standard", "apps/web/evals", "apps/web/scripts/planner-eval.ts"],
              { cwd: root, encoding: "utf8" },
            ).trim(),
          ),
        createdAt: new Date().toISOString(),
        cases: [],
      };
  if (
    report.signature !== signature ||
    !Array.isArray(report.cases) ||
    new Set(report.cases.map((c) => c.id)).size !== report.cases.length
  )
    throw new Error("resume_mismatch");
  mkdirSync(dirname(path), { recursive: true });
  const save = () => {
    writeFileSync(`${path}.tmp`, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    renameSync(`${path}.tmp`, path);
  };
  for (const test of selected) {
    if (report.cases.some((r) => r.id === test.id)) continue;
    const started = Date.now();
    const row: CaseResult = {
      id: test.id,
      at: new Date().toISOString(),
      durationMs: 0,
      coachCorrections: null,
      humanAudio: null,
    };
    const provider = openAiPlannerProvider(async (url, options) => {
      const response = await fetch(url, options);
      if (response.ok) {
        const body = await response
          .clone()
          .json()
          .catch(() => null);
        if (Array.isArray(body?.output))
          row.providerText = body.output
            .flatMap((item: { content?: { type?: string; text?: string }[] }) => item.content ?? [])
            .filter((part: { type?: string; text?: string }) => part.type === "output_text")
            .map((part: { text?: string }) => part.text ?? "")
            .join("\n")
            .slice(0, 100000);
      }
      return response;
    });
    try {
      row.result = await provider.interpret({
        ...corpusContext,
        targets: test.targets ?? corpusContext.targets,
        instructions: test.instructions,
      });
      row.score = scorePlannerCase(test, row.result);
    } catch (cause) {
      row.error = cause instanceof PlannerProviderError ? cause.code : "local_error";
    }
    row.durationMs = Date.now() - started;
    report.cases.push(row);
    save();
    console.log(
      JSON.stringify({
        id: row.id,
        passed: row.score?.passed ?? false,
        differences: row.score?.differences,
        error: row.error,
        durationMs: row.durationMs,
      }),
    );
  }
  const selectedRows = selected.map((test) => report.cases.find((row) => row.id === test.id));
  const failed = selectedRows.filter((row) => !row?.score?.passed).length;
  const complete = plannerCorpus.every((c) => report.cases.some((r) => r.id === c.id));
  console.log(
    JSON.stringify({
      report: path,
      model,
      selected: selected.length,
      failed,
      completeTextCorpus: complete,
      evaluated: report.cases.length,
      passed: report.cases.filter((r) => r.score?.passed).length,
      criticalClarifications: {
        expected: plannerCorpus.filter((c) => c.expected.status === "clarification").length,
        correct: report.cases.filter(
          (r) => r.score?.passed && plannerCorpus.find((c) => c.id === r.id)?.expected.status === "clarification",
        ).length,
      },
      exerciseMapping: {
        expected: plannerCorpus.reduce(
          (n, c) =>
            n +
            (c.expected.status === "proposal" ? c.expected.sessions.reduce((sum, s) => sum + s.items.length, 0) : 0),
          0,
        ),
        correct: report.cases.reduce((n, r) => n + (r.score?.exerciseMatches ?? 0), 0),
      },
      falseDates: report.cases.filter((r) => r.score?.falseDate).map((r) => r.id),
      inventedLoads: report.cases.filter((r) => r.score?.inventedLoad).map((r) => r.id),
      humanRecordings: 0,
      coachReview: "pending",
      betaQualified: false,
    }),
  );
  if (failed) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Évaluation interrompue : vérifier arguments, reprise et configuration locale. Aucun secret n’est affiché.",
  );
  process.exitCode = 1;
});
