// Le lanceur : il déroule les passages, note chaque cas et chaque paire, compte le coût et s'arrête net quand le
// budget est dépassé. Il ne connaît ni la base ni le service : un pilote (`E2eDriver`) les lui apporte, ce qui
// permet de l'éprouver avec des sorties fabriquées.
import { caseInput, type E2eCaseInput, type E2eCorpus, type E2eLibrary } from "./format";
import { observedError, type Observed } from "./observation";
import { scorePair, type E2ePairs, type PairResolution } from "./pairs/format";
import { PRICES_STATUS, sumCosts } from "./prices";
import { finalize, type E2eReport, type Row, type StepUsage, type Timing } from "./report";
import { scoreCase } from "./score";
import { E2E_REQUIRED_RUNS, E2E_THRESHOLDS } from "./thresholds";

export type CaseOutcome = {
  observed: Observed;
  timing: Timing;
  usage: StepUsage[];
  legacy?: Record<string, unknown>;
};
export type PairOutcome = { resolution: PairResolution; timing: Timing; usage: StepUsage[]; error: string | null };

/** Ce qui fait tourner le planificateur pour un cas. Il ne reçoit jamais les attentes. */
export interface E2eDriver {
  provider: "fake" | "openai";
  // Ce que le pilote a dû contourner pour mesurer le pipeline en place.
  limits: string[];
  runCase(input: E2eCaseInput): Promise<CaseOutcome>;
  // Seul le terme dit part vers le planificateur, avec la bibliothèque de référence.
  runPair(said: string, library: E2eLibrary): Promise<PairOutcome>;
}

export type RunnerOptions = {
  runs: number;
  only?: string[];
  suite: "all" | "cases" | "pairs";
  // Arrêt net dès que le coût cumulé dépasse ce montant, en dollars. `null` : pas de plafond.
  maxCostUsd: number | null;
  concurrency: number;
  onRow?: (row: Row) => void;
};

export type RunnerInput = {
  corpus: { file: string; hash: string; corpus: E2eCorpus } | null;
  pairs: { file: string; hash: string; pairs: E2ePairs } | null;
  driver: E2eDriver;
  options: RunnerOptions;
  // `examples` : les cas du README à la place du corpus. Ils éprouvent l'outil et ne qualifient jamais rien.
  meta: { commit: string | null; model: string; fastModel: string | null; createdAt?: string; examples?: boolean };
};

const noTiming: Timing = { firstEventMs: null, firstPlanMs: null, completeMs: 0 };

export async function runE2e({ corpus, pairs, driver, options, meta }: RunnerInput): Promise<E2eReport> {
  if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 10) throw new Error("invalid_runs");
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 8)
    throw new Error("invalid_concurrency");
  const only = options.only ? new Set(options.only) : null;
  const cases = options.suite === "pairs" ? [] : (corpus?.corpus.cases ?? []).filter((c) => !only || only.has(c.id));
  const terms = options.suite === "cases" ? [] : (pairs?.pairs.pairs ?? []).filter((p) => !only || only.has(p.id));
  if (only) {
    const known = new Set([...(corpus?.corpus.cases ?? []), ...(pairs?.pairs.pairs ?? [])].map((entry) => entry.id));
    const unknown = [...only].filter((id) => !known.has(id));
    if (unknown.length) throw new Error(`unknown_ids: ${unknown.join(", ")}`);
  }
  if (!cases.length && !terms.length) throw new Error("nothing_to_measure");

  const rows: Row[] = [];
  let spent = 0;
  let stopped: E2eReport["stopped"] = null;
  const record = (row: Row) => {
    rows.push(row);
    // Un modèle sans prix : le coût n'est plus connu, donc le plafond non plus. On s'arrête.
    if (row.costUsd === null) stopped ??= "unknown_price";
    else {
      spent += row.costUsd;
      if (options.maxCostUsd !== null && spent > options.maxCostUsd) stopped ??= "max_cost";
    }
    options.onRow?.(row);
  };

  for (let run = 1; run <= options.runs && !stopped; run++) {
    const tasks: (() => Promise<void>)[] = [
      ...cases.map((test) => async () => {
        let outcome: CaseOutcome;
        try {
          outcome = await driver.runCase(caseInput(test));
        } catch {
          outcome = { observed: observedError("driver_failure"), timing: noTiming, usage: [] };
        }
        record({
          suite: "case",
          run,
          id: test.id,
          kind: test.kind,
          spoken: test.spoken,
          mustAsk: Boolean(test.expect.mustAsk),
          observed: outcome.observed,
          score: scoreCase(test, outcome.observed),
          timing: outcome.timing,
          usage: outcome.usage,
          costUsd: sumCosts(outcome.usage.map((entry) => entry.costUsd)),
          ...(outcome.legacy ? { legacy: outcome.legacy } : {}),
        });
      }),
      ...terms.map((pair) => async () => {
        let outcome: PairOutcome;
        try {
          outcome = await driver.runPair(pair.said, pairs!.pairs.library);
        } catch {
          outcome = {
            resolution: { first: null, proposals: [], toVerify: false },
            timing: noTiming,
            usage: [],
            error: "driver_failure",
          };
        }
        record({
          suite: "pair",
          run,
          id: pair.id,
          absent: Boolean(pair.absent),
          resolution: outcome.resolution,
          // Une panne n'est jamais une bonne réponse, même pour un terme absent.
          score: outcome.error
            ? { top1: false, top3: false, falsePositive: false }
            : scorePair(pair, outcome.resolution),
          timing: outcome.timing,
          usage: outcome.usage,
          costUsd: sumCosts(outcome.usage.map((entry) => entry.costUsd)),
          error: outcome.error,
        });
      }),
    ];
    // Simultanéité bornée. Aucune tâche ne démarre après l'arrêt : le dépassement se limite aux tâches en vol.
    const worker = async () => {
      for (let task = tasks.shift(); task && !stopped; task = tasks.shift()) await task();
    };
    await Promise.all(Array.from({ length: Math.min(options.concurrency, tasks.length) }, worker));
  }

  const expected = options.runs * (cases.length + terms.length);
  return finalize({
    tool: "planner-e2e",
    version: 2,
    createdAt: meta.createdAt ?? new Date().toISOString(),
    commit: meta.commit,
    provider: driver.provider,
    model: meta.model,
    fastModel: meta.fastModel,
    concurrency: options.concurrency,
    requestedRuns: options.runs,
    corpus: corpus
      ? { file: corpus.file, hash: corpus.hash, cases: corpus.corpus.cases.length, selected: cases.length }
      : null,
    pairs: pairs
      ? { file: pairs.file, hash: pairs.hash, pairs: pairs.pairs.pairs.length, selected: terms.length }
      : null,
    thresholds: E2E_THRESHOLDS,
    pricesStatus: PRICES_STATUS,
    maxCostUsd: options.maxCostUsd,
    stopped,
    examples: Boolean(meta.examples),
    complete:
      !meta.examples &&
      driver.provider === "openai" &&
      !only &&
      options.suite === "all" &&
      options.runs >= E2E_REQUIRED_RUNS &&
      Boolean(corpus) &&
      Boolean(pairs) &&
      stopped === null &&
      rows.length === expected,
    pipelineLimits: driver.limits,
    rows,
  });
}
