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
  result?: PlannerInterpretation;
  score?: ReturnType<typeof scoreIndependentCase>;
  error?: string;
  providerTexts: string[];
};
async function main() {
  const root = resolve(import.meta.dirname, "../../..");
  for (const test of independentCorpus.cases) plannerProviderContext.parse(independentContext(test));
  if (new Set(independentCorpus.cases.map((c) => c.id)).size !== 80) throw new Error("duplicate_case");
  const source = option("--rescore");
  if (source) {
    const output = option("--output");
    if (!output || existsSync(resolve(root, output))) throw new Error("new_output_required");
    const report = JSON.parse(readFileSync(resolve(root, source), "utf8")) as { corpusHash: string; rows: Row[] };
    if (report.corpusHash !== independentHash) throw new Error("corpus_mismatch");
    for (const row of report.rows) {
      const test = independentCorpus.cases.find((test) => test.id === row.id);
      if (!test) throw new Error("unknown_case");
      if (row.result) row.score = scoreIndependentCase(test, row.result);
    }
    writeFileSync(
      resolve(root, output),
      JSON.stringify(
        {
          ...report,
          rescoredAt: new Date().toISOString(),
          scorerHash: hash(readFileSync(resolve(root, "apps/web/evals/planner-independent.ts"), "utf8")),
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
  if (ids?.some((id) => !independentCorpus.cases.some((c) => c.id === id))) throw new Error("unknown_case");
  const selected = independentCorpus.cases.filter((c) => !ids || ids.includes(c.id));
  if (!process.argv.includes("--live")) {
    console.log(
      JSON.stringify({
        cases: 80,
        selected: selected.length,
        corpusHash: independentHash,
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
  const model = process.env.AI_PLANNER_MODEL || local.AI_PLANNER_MODEL || "gpt-4.1-mini";
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
    ["ls-files", "apps/web/src/server/ai", "packages/domain/src", "packages/contracts/src"],
    { cwd: root, encoding: "utf8" },
  )
    .trim()
    .split("\n");
  files.push("apps/web/evals/planner-independent.ts", "apps/web/scripts/planner-independent-eval.ts");
  const implementationHash = hash(
    files
      .sort()
      .map((p) => `${p}\n${readFileSync(resolve(root, p), "utf8")}`)
      .join("\n"),
  );
  const signature = hash(`${independentHash}:${implementationHash}:${model}`);
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
        corpusHash: independentHash,
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
            row.result = await provider.interpret(independentContext(test));
            row.score = scoreIndependentCase(test, row.result);
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
    const rows = report.rows.filter((row) => row.run === run);
    console.log(
      JSON.stringify({
        run,
        evaluated: rows.length,
        passed: rows.filter((r) => r.score?.passed).length,
        critical: rows.filter((r) => r.score?.critical.length).map((r) => r.id),
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
