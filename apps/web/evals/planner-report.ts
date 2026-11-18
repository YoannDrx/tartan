// Ce qu'un rapport d'évaluation du planificateur dit, passage par passage : réussites, questions posées à tort,
// latence, appels et jetons. Pur : il se rejoue sur un ancien rapport sans refaire un seul appel.
export type EvalRow = {
  run: number;
  id: string;
  durationMs: number;
  calls: number;
  // Absents des rapports d'avant le 17 novembre 2026 : le coût se lit alors chez le prestataire.
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
  score?: { passed: boolean; differences: string[]; critical: string[] };
};

export type RunSummary = {
  run: number;
  evaluated: number;
  passed: number;
  // Une question alors que la consigne suffisait : le premier défaut que ressent un coach.
  falseQuestions: number;
  errors: number;
  critical: string[];
  calls: number;
  p50Ms: number;
  p95Ms: number;
  inputTokens: number | null;
  outputTokens: number | null;
};

const percentile = (sorted: number[], share: number) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))]! : 0;

export const summarizeRuns = (rows: EvalRow[]): RunSummary[] =>
  [...new Set(rows.map((row) => row.run))]
    .sort((a, b) => a - b)
    .map((run) => {
      const mine = rows.filter((row) => row.run === run);
      const durations = mine.map((row) => row.durationMs).sort((a, b) => a - b);
      const counted = mine.every((row) => row.inputTokens !== undefined && row.outputTokens !== undefined);
      return {
        run,
        evaluated: mine.length,
        passed: mine.filter((row) => row.score?.passed).length,
        falseQuestions: mine.filter((row) => row.score?.differences.includes("unexpected_question")).length,
        errors: mine.filter((row) => row.error).length,
        critical: mine.filter((row) => row.score?.critical.length).map((row) => row.id),
        calls: mine.reduce((sum, row) => sum + row.calls, 0),
        p50Ms: percentile(durations, 0.5),
        p95Ms: percentile(durations, 0.95),
        inputTokens: counted ? mine.reduce((sum, row) => sum + (row.inputTokens ?? 0), 0) : null,
        outputTokens: counted ? mine.reduce((sum, row) => sum + (row.outputTokens ?? 0), 0) : null,
      };
    });

// Le coût, d'après les jetons comptés et un prix par million donné à la main : les tarifs changent, on ne les fige pas.
export const costOf = (
  runs: RunSummary[],
  price: { inputPerMillion: number; outputPerMillion: number },
): number | null =>
  runs.some((run) => run.inputTokens === null || run.outputTokens === null)
    ? null
    : Math.round(
        runs.reduce(
          (sum, run) =>
            sum + (run.inputTokens! * price.inputPerMillion + run.outputTokens! * price.outputPerMillion) / 1e6,
          0,
        ) * 100,
      ) / 100;
