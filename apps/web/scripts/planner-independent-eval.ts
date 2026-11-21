// No database or customer data. Live evaluation is explicit and kept out of CI.
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import dotenv from "dotenv";
import {
  independentCorpus,
  independentContext,
  independentHash,
  scoreIndependentCase,
} from "../evals/planner-independent";
import { costOf, summarizeRuns } from "../evals/planner-report";
import { lotHContext, lotHCorpus, lotHHash, scoreLotHCase } from "../evals/planner-lot-h";
import { interpretPlannerContext } from "../src/server/ai/pipeline";
import { openAiPlannerProvider, plannerProviderContext, PlannerProviderError } from "../src/server/ai/provider";
import type { PlannerInterpretation } from "@tartan/contracts";
const option = (name: string) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type Row = {
  id: string;
  run: number;
  at: string;
  durationMs: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  result?: PlannerInterpretation;
  score?: ReturnType<typeof scoreIndependentCase>;
  error?: string;
  providerTexts: string[];
};
// `--corpus lot-h` : le jeu neuf de 20 cas du lot H (séries détaillées, autonomie, ajustement, contexte).
const lotH = option("--corpus") === "lot-h";
type Suite = {
  cases: { id: string }[];
  hash: string;
  context: (test: never) => unknown;
  score: (test: never, value: unknown) => ReturnType<typeof scoreIndependentCase>;
  scorerFile: string;
};
const suite: Suite = lotH
  ? {
      cases: lotHCorpus.cases,
      hash: lotHHash,
      context: lotHContext,
      score: scoreLotHCase,
      scorerFile: "apps/web/evals/planner-lot-h.ts",
    }
  : {
      cases: independentCorpus.cases,
      hash: independentHash,
      context: independentContext,
      score: scoreIndependentCase,
      scorerFile: "apps/web/evals/planner-independent.ts",
    };
async function main() {
  const root = resolve(import.meta.dirname, "../../..");
  for (const test of suite.cases) plannerProviderContext.parse(suite.context(test as never));
  if (new Set(suite.cases.map((c) => c.id)).size !== suite.cases.length) throw new Error("duplicate_case");
  // Relire un rapport existant, sans aucun appel : réussites, questions posées à tort, latence, jetons et coût.
  const summary = option("--summary");
  if (summary) {
    const runs = summarizeRuns((JSON.parse(readFileSync(resolve(root, summary), "utf8")) as { rows: Row[] }).rows);
    const [priceIn, priceOut] = [Number(option("--price-in")), Number(option("--price-out"))];
    const cost =
      Number.isFinite(priceIn) && Number.isFinite(priceOut)
        ? costOf(runs, { inputPerMillion: priceIn, outputPerMillion: priceOut })
        : undefined;
    console.log(JSON.stringify({ runs, ...(cost === undefined ? {} : { cost }) }, null, 2));
    return;
  }
  const source = option("--rescore");
  if (source) {
    const output = option("--output");
    if (!output || existsSync(resolve(root, output))) throw new Error("new_output_required");
    const report = JSON.parse(readFileSync(resolve(root, source), "utf8")) as { corpusHash: string; rows: Row[] };
    if (report.corpusHash !== suite.hash) throw new Error("corpus_mismatch");
    for (const row of report.rows) {
      const test = suite.cases.find((test) => test.id === row.id);
      if (!test) throw new Error("unknown_case");
      if (row.result) row.score = suite.score(test as never, row.result);
    }
    writeFileSync(
      resolve(root, output),
      JSON.stringify(
        {
          ...report,
          rescoredAt: new Date().toISOString(),
          scorerHash: hash(readFileSync(resolve(root, suite.scorerFile), "utf8")),
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    for (const run of new Set(report.rows.map((row) => row.run))) {
      const rows = report.rows.filter((row) => row.run === run);
      console.log(
        JSON.stringify({
          run,
          passed: rows.filter((row) => row.score?.passed).length,
          critical: rows.filter((row) => row.score?.critical.length).map((row) => row.id),
          providerCalls: 0,
        }),
      );
    }
    return;
  }
  const ids = option("--ids")?.split(",");
  if (ids?.some((id) => !suite.cases.some((c) => c.id === id))) throw new Error("unknown_case");
  const selected = suite.cases.filter((c) => !ids || ids.includes(c.id));
  if (!process.argv.includes("--live")) {
    console.log(
      JSON.stringify({
        cases: suite.cases.length,
        selected: selected.length,
        corpusHash: suite.hash,
        providerCalls: 0,
        humanReview: "pending",
        scope: "provider-only; catalog approval gate not bypassed in the app",
      }),
    );
    return;
  }
  const localPath = resolve(root, ".env.local");
  const local = existsSync(localPath) ? dotenv.parse(readFileSync(localPath)) : {};
  const key =
    process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY || local.OPENAI_API_KEY || local.OPEN_AI_API_KEY;
  if (!key) throw new Error("missing_key");
  const model = process.env.AI_PLANNER_MODEL || local.AI_PLANNER_MODEL || "gpt-4.1";
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
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps/web/src/server/ai",
      "packages/domain/src",
      "packages/contracts/src",
    ],
    { cwd: root, encoding: "utf8" },
  )
    .trim()
    .split("\n");
  files.push("apps/web/evals/planner-independent.ts", "apps/web/scripts/planner-independent-eval.ts", suite.scorerFile);
  const implementationHash = hash(
    files
      .sort()
      .map((p) => `${p}\n${readFileSync(resolve(root, p), "utf8")}`)
      .join("\n"),
  );
  const signature = hash(`${suite.hash}:${implementationHash}:${model}`);
  const path = resolve(
    root,
    option("--resume") ?? option("--output") ?? `.local/planner-independent-${Date.now()}.json`,
  );
  if (!option("--resume") && existsSync(path)) throw new Error("output_exists");
  const report: {
    signature: string;
    model: string;
    corpusHash: string;
    implementationHash: string;
    commit: string;
    createdAt: string;
    scope: string;
    humanReview: string;
    rows: Row[];
  } = option("--resume")
    ? JSON.parse(readFileSync(path, "utf8"))
    : {
        signature,
        model,
        corpusHash: suite.hash,
        implementationHash,
        commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
        createdAt: new Date().toISOString(),
        scope: "Provider only, synthetic catalog fixture. No human catalog approval or app-gate proof.",
        humanReview: "pending",
        rows: [],
      };
  if (report.signature !== signature) throw new Error("resume_mismatch");
  mkdirSync(dirname(path), { recursive: true });
  const save = () => {
    writeFileSync(`${path}.tmp`, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    renameSync(`${path}.tmp`, path);
  };
  const runs = Number(option("--runs") ?? 3);
  if (!Number.isInteger(runs) || runs < 1 || runs > 3) throw new Error("invalid_runs");
  for (let run = 1; run <= runs; run++) {
    // Bounded parallelism, each logical case owns at most one provider retry.
    const pending = selected.filter((test) => !report.rows.some((row) => row.run === run && row.id === test.id));
    for (let start = 0; start < pending.length; start += 3) {
      await Promise.all(
        pending.slice(start, start + 3).map(async (test) => {
          const row: Row = {
            id: test.id,
            run,
            at: new Date().toISOString(),
            durationMs: 0,
            calls: 0,
            inputTokens: 0,
            outputTokens: 0,
            providerTexts: [],
          };
          const started = Date.now();
          const provider = openAiPlannerProvider(async (url, options) => {
            row.calls++;
            const response = await fetch(url, options);
            if (response.ok) {
              const body = await response
                .clone()
                .json()
                .catch(() => null);
              row.inputTokens += Number(body?.usage?.input_tokens ?? 0);
              row.outputTokens += Number(body?.usage?.output_tokens ?? 0);
              if (Array.isArray(body?.output))
                row.providerTexts.push(
                  body.output
                    .flatMap((item: { content?: { type?: string; text?: string }[] }) => item.content ?? [])
                    .filter((part: { type?: string }) => part.type === "output_text")
                    .map((part: { text?: string }) => part.text ?? "")
                    .join("\n")
                    .slice(0, 100000),
                );
            }
            return response;
          });
          try {
            row.result = await interpretPlannerContext(suite.context(test as never) as never, provider);
            row.score = suite.score(test as never, row.result);
          } catch (cause) {
            row.error = cause instanceof PlannerProviderError ? cause.code : "local_error";
          }
          row.durationMs = Date.now() - started;
          report.rows.push(row);
          save();
          console.log(
            JSON.stringify({
              run,
              id: row.id,
              passed: row.score?.passed ?? false,
              differences: row.score?.differences,
              critical: row.score?.critical,
              error: row.error,
              calls: row.calls,
            }),
          );
        }),
      );
    }
    console.log(
      JSON.stringify({
        ...summarizeRuns(report.rows.filter((row) => row.run === run))[0],
        humanReview: "pending",
      }),
    );
  }
  if (report.rows.some((r) => !r.score?.passed)) process.exitCode = 1;
}
main().catch(() => {
  console.error("Independent planner evaluation failed; no credentials or provider error body logged.");
  process.exitCode = 1;
});
