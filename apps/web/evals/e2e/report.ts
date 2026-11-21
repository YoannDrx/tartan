// Le rapport de la mesure : une ligne par cas et par paire, un résumé par passage, et le verdict des seuils.
// Pur : `summarize` se rejoue sur un rapport enregistré sans refaire un appel (`--summary`).
import type { E2eCase } from "./format";
import type { Observed } from "./observation";
import type { PairResolution, PairScore } from "./pairs/format";
import { sumCosts } from "./prices";
import type { CaseScore } from "./score";
import { checkThresholds, thresholdsHeld, E2E_THRESHOLDS, type ThresholdVerdict } from "./thresholds";

/** Appels et jetons d'une étape du planificateur, pour un modèle. Le coût est `null` si le modèle n'a pas de prix. */
export type StepUsage = {
  step: string;
  model: string;
  calls: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  costUsd: number | null;
};
export type Timing = {
  // Premier événement diffusé, quel qu'il soit. `null` : rien n'a été diffusé avant la fin.
  firstEventMs: number | null;
  // Première ligne du plan de la séance : le premier contenu que le coach lit.
  firstPlanMs: number | null;
  // Résultat complet : brouillons préparés, ou question rendue.
  completeMs: number;
};
type RowBase = { run: number; id: string; timing: Timing; usage: StepUsage[]; costUsd: number | null };
export type CaseRow = RowBase & {
  suite: "case";
  kind: E2eCase["kind"];
  spoken: boolean;
  mustAsk: boolean;
  observed: Observed;
  score: CaseScore;
  // Ce que l'outil a dû fournir au pipeline actuel et que la consigne ne dit pas (mode, période, brief).
  legacy?: Record<string, unknown>;
};
export type PairRow = RowBase & {
  suite: "pair";
  absent: boolean;
  resolution: PairResolution;
  score: PairScore;
  error: string | null;
};
export type Row = CaseRow | PairRow;

export type RunSummary = {
  run: number;
  cases: {
    evaluated: number;
    passed: number;
    accuracy: number | null;
    mustNotAsk: number;
    needlessQuestions: number;
    needlessQuestionRate: number | null;
    errors: number;
    criticalFaults: number;
    criticalCases: { id: string; faults: string[] }[];
    // Les mêmes comptes pour les consignes écrites et celles au style dicté.
    written: { evaluated: number; passed: number };
    spoken: { evaluated: number; passed: number };
    byKind: Record<string, { evaluated: number; passed: number }>;
    // Les écarts les plus fréquents, pour savoir où regarder d'abord.
    differences: Record<string, number>;
  };
  pairs: {
    evaluated: number;
    top1: number;
    top1Accuracy: number | null;
    present: number;
    top3: number;
    top3Accuracy: number | null;
    absent: number;
    falsePositives: number;
    falsePositiveRate: number | null;
    errors: number;
  };
  latency: {
    firstEventMedianMs: number | null;
    firstPlanMedianMs: number | null;
    completeMedianMs: number | null;
    completeP95Ms: number | null;
  };
  usage: {
    calls: number;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    costUsd: number | null;
    steps: StepUsage[];
  };
  thresholds: ThresholdVerdict[];
  ok: boolean;
};

export const median = (values: readonly number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};
const percentile = (values: readonly number[], share: number): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))]!;
};
const rate = (part: number, whole: number) => (whole ? part / whole : null);

export function mergeUsage(usage: readonly StepUsage[]): StepUsage[] {
  const merged = new Map<string, StepUsage>();
  for (const entry of usage) {
    const key = `${entry.step}\n${entry.model}`;
    const current = merged.get(key);
    if (!current) merged.set(key, { ...entry });
    else {
      current.calls += entry.calls;
      current.inputTokens += entry.inputTokens;
      current.cachedInputTokens += entry.cachedInputTokens;
      current.outputTokens += entry.outputTokens;
      current.costUsd = sumCosts([current.costUsd, entry.costUsd]);
    }
  }
  return [...merged.values()];
}

export function summarize(rows: readonly Row[], thresholds = E2E_THRESHOLDS): RunSummary[] {
  return [...new Set(rows.map((row) => row.run))]
    .sort((a, b) => a - b)
    .map((run) => {
      const mine = rows.filter((row) => row.run === run);
      const cases = mine.filter((row): row is CaseRow => row.suite === "case");
      const pairs = mine.filter((row): row is PairRow => row.suite === "pair");
      const count = (list: CaseRow[]) => ({
        evaluated: list.length,
        passed: list.filter((row) => row.score.passed).length,
      });
      const free = cases.filter((row) => !row.mustAsk);
      const needless = free.filter((row) => row.score.needlessQuestion).length;
      const criticalCases = cases
        .filter((row) => row.score.critical.length)
        .map((row) => ({ id: row.id, faults: row.score.critical }));
      const differences: Record<string, number> = {};
      for (const row of cases)
        for (const code of row.score.differences) differences[code] = (differences[code] ?? 0) + 1;
      const byKind: RunSummary["cases"]["byKind"] = {};
      for (const kind of new Set(cases.map((row) => row.kind)))
        byKind[kind] = count(cases.filter((row) => row.kind === kind));
      // Une panne rendue en un instant ne doit pas flatter la latence : seules les réponses comptent.
      const answered = cases.filter((row) => row.observed.status !== "error");
      const present = pairs.filter((row) => !row.absent),
        absent = pairs.filter((row) => row.absent);
      const falsePositives = absent.filter((row) => row.score.falsePositive).length;
      const steps = mergeUsage(mine.flatMap((row) => row.usage));
      const summary = {
        run,
        cases: {
          ...count(cases),
          accuracy: rate(count(cases).passed, cases.length),
          mustNotAsk: free.length,
          needlessQuestions: needless,
          needlessQuestionRate: rate(needless, free.length),
          errors: cases.filter((row) => row.observed.status === "error").length,
          criticalFaults: criticalCases.reduce((sum, entry) => sum + entry.faults.length, 0),
          criticalCases,
          written: count(cases.filter((row) => !row.spoken)),
          spoken: count(cases.filter((row) => row.spoken)),
          byKind,
          differences,
        },
        pairs: {
          evaluated: pairs.length,
          top1: pairs.filter((row) => row.score.top1).length,
          top1Accuracy: rate(pairs.filter((row) => row.score.top1).length, pairs.length),
          present: present.length,
          top3: present.filter((row) => row.score.top3).length,
          top3Accuracy: rate(present.filter((row) => row.score.top3).length, present.length),
          absent: absent.length,
          falsePositives,
          falsePositiveRate: rate(falsePositives, absent.length),
          errors: pairs.filter((row) => row.error).length,
        },
        latency: {
          firstEventMedianMs: median(
            answered.flatMap((row) => (row.timing.firstEventMs === null ? [] : [row.timing.firstEventMs])),
          ),
          firstPlanMedianMs: median(
            answered.flatMap((row) => (row.timing.firstPlanMs === null ? [] : [row.timing.firstPlanMs])),
          ),
          completeMedianMs: median(answered.map((row) => row.timing.completeMs)),
          completeP95Ms: percentile(
            answered.map((row) => row.timing.completeMs),
            0.95,
          ),
        },
        usage: {
          calls: steps.reduce((sum, step) => sum + step.calls, 0),
          inputTokens: steps.reduce((sum, step) => sum + step.inputTokens, 0),
          cachedInputTokens: steps.reduce((sum, step) => sum + step.cachedInputTokens, 0),
          outputTokens: steps.reduce((sum, step) => sum + step.outputTokens, 0),
          costUsd: sumCosts(steps.map((step) => step.costUsd)),
          steps,
        },
      };
      const verdicts = checkThresholds(
        {
          criticalFaults: cases.length ? summary.cases.criticalFaults : null,
          caseAccuracy: summary.cases.accuracy,
          needlessQuestionRate: summary.cases.needlessQuestionRate,
          pairTop1Accuracy: summary.pairs.top1Accuracy,
          absentFalsePositiveRate: summary.pairs.falsePositiveRate,
          firstEventMedianMs: summary.latency.firstEventMedianMs,
          completeMedianMs: summary.latency.completeMedianMs,
        },
        thresholds,
      );
      return { ...summary, thresholds: verdicts, ok: thresholdsHeld(verdicts) };
    });
}

export type E2eReport = {
  tool: "planner-e2e";
  version: 2;
  createdAt: string;
  commit: string | null;
  provider: "fake" | "openai";
  model: string;
  fastModel: string | null;
  concurrency: number;
  requestedRuns: number;
  corpus: { file: string; hash: string; cases: number; selected: number } | null;
  pairs: { file: string; hash: string; pairs: number; selected: number } | null;
  thresholds: typeof E2E_THRESHOLDS;
  pricesStatus: string;
  maxCostUsd: number | null;
  // Arrêt avant la fin : budget dépassé, ou modèle sans prix connu.
  stopped: "max_cost" | "unknown_price" | null;
  // Les cas du README à la place du corpus : ils éprouvent l'outil, pas le planificateur.
  examples: boolean;
  // Vrai seulement si tout le corpus et toutes les paires ont été mesurés, sur le vrai fournisseur, à trois passages.
  complete: boolean;
  // Ce que l'outil a dû contourner pour mesurer le pipeline en place.
  pipelineLimits: string[];
  rows: Row[];
  runs: RunSummary[];
  costUsd: number | null;
  // Chaque seuil mesuré est tenu à chaque passage, et la mesure est allée à son terme. Décide du code de sortie.
  thresholdsHeld: boolean;
  // Le verdict qui qualifie : seuils tenus sur une mesure complète (tout le corpus, toutes les paires, trois passages).
  passed: boolean;
};

export function finalize(report: Omit<E2eReport, "runs" | "costUsd" | "thresholdsHeld" | "passed">): E2eReport {
  const runs = summarize(report.rows, report.thresholds);
  const held = report.stopped === null && runs.length > 0 && runs.every((run) => run.ok);
  return {
    ...report,
    runs,
    costUsd: sumCosts(report.rows.map((row) => row.costUsd)),
    thresholdsHeld: held,
    passed: held && report.complete,
  };
}

const percent = (value: number | null) =>
  value === null ? "non mesuré" : `${(value * 100).toFixed(1).replace(".", ",")} %`;
const seconds = (value: number | null) =>
  value === null ? "non mesuré" : `${(value / 1000).toFixed(2).replace(".", ",")} s`;
const dollars = (value: number | null) =>
  value === null ? "inconnu (modèle sans prix)" : `${value.toFixed(4).replace(".", ",")} $`;
const verdictValue = (verdict: ThresholdVerdict) =>
  verdict.value === null
    ? "non mesuré"
    : verdict.key.endsWith("Ms")
      ? seconds(verdict.value)
      : verdict.key === "criticalFaults"
        ? String(verdict.value)
        : percent(verdict.value);
const verdictLimit = (verdict: ThresholdVerdict) =>
  `${{ max: "au plus", min: "au moins", below: "sous" }[verdict.rule]} ${
    verdict.key.endsWith("Ms")
      ? seconds(verdict.limit)
      : verdict.key === "criticalFaults"
        ? verdict.limit
        : percent(verdict.limit)
  }`;

/** Le résumé lisible : ce qu'on colle dans un compte rendu. Aucune consigne n'y figure, seulement des identifiants. */
export function renderSummary(report: E2eReport): string {
  const lines: string[] = [];
  lines.push("Mesure de bout en bout du planificateur");
  lines.push(
    `Prestataire : ${report.provider === "fake" ? "simulé (aucun appel réel)" : `OpenAI, modèle ${report.model}`}` +
      (report.fastModel ? `, modèle rapide ${report.fastModel}` : ""),
  );
  if (report.corpus)
    lines.push(
      `Corpus : ${report.corpus.selected} cas sur ${report.corpus.cases}, empreinte ${report.corpus.hash.slice(0, 12)}`,
    );
  if (report.pairs)
    lines.push(
      `Paires : ${report.pairs.selected} sur ${report.pairs.pairs}, empreinte ${report.pairs.hash.slice(0, 12)}`,
    );
  lines.push(
    `Commit : ${report.commit ?? "inconnu"} · simultanéité ${report.concurrency} · prix ${report.pricesStatus}`,
  );
  if (report.examples) lines.push("EXEMPLES : ces cas montrent le format. Ils éprouvent l'outil et ne mesurent rien.");
  else if (report.provider === "fake")
    lines.push("PRESTATAIRE SIMULÉ : ce passage éprouve l'outil, pas le planificateur.");
  else if (!report.complete)
    lines.push("MESURE PARTIELLE : une partie du corpus, des paires ou des trois passages n'a pas été mesurée.");
  if (report.stopped === "max_cost")
    lines.push(`ARRÊT : le coût cumulé a dépassé --max-cost (${report.maxCostUsd} $).`);
  if (report.stopped === "unknown_price")
    lines.push("ARRÊT : un modèle appelé n'a pas de prix dans evals/e2e/prices.ts.");
  for (const run of report.runs) {
    lines.push("");
    lines.push(`Passage ${run.run} : ${run.ok ? "seuils tenus" : "SEUILS NON TENUS"}`);
    for (const verdict of run.thresholds)
      lines.push(
        `  ${verdict.ok === null ? "  ·  " : verdict.ok ? " ok  " : "ÉCHEC"} ${verdict.label.padEnd(38)} ${verdictValue(verdict).padEnd(12)} (${verdictLimit(verdict)})`,
      );
    lines.push(
      `  Cas : ${run.cases.passed}/${run.cases.evaluated} justes · écrits ${run.cases.written.passed}/${run.cases.written.evaluated} · dictés ${run.cases.spoken.passed}/${run.cases.spoken.evaluated} · pannes ${run.cases.errors}`,
    );
    lines.push(
      `  Par nature : ${
        Object.entries(run.cases.byKind)
          .map(([kind, c]) => `${kind} ${c.passed}/${c.evaluated}`)
          .join(" · ") || "aucun cas"
      }`,
    );
    lines.push(
      `  Questions inutiles : ${run.cases.needlessQuestions} sur ${run.cases.mustNotAsk} cas sans question attendue`,
    );
    if (run.cases.criticalCases.length)
      lines.push(
        `  Fautes graves : ${run.cases.criticalCases.map((entry) => `${entry.id} (${entry.faults.join(", ")})`).join(" · ")}`,
      );
    const frequent = Object.entries(run.cases.differences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    if (frequent.length) lines.push(`  Écarts fréquents : ${frequent.map(([code, n]) => `${code} ${n}`).join(" · ")}`);
    if (run.pairs.evaluated)
      lines.push(
        `  Paires : premier choix ${run.pairs.top1}/${run.pairs.evaluated} · dans les 3 propositions ${run.pairs.top3}/${run.pairs.present} · fiche choisie à tort ${run.pairs.falsePositives}/${run.pairs.absent} absents`,
      );
    lines.push(
      `  Latence : premier événement ${seconds(run.latency.firstEventMedianMs)} · premier plan ${seconds(run.latency.firstPlanMedianMs)} · complet ${seconds(run.latency.completeMedianMs)} (95e centile ${seconds(run.latency.completeP95Ms)})`,
    );
    lines.push(
      `  Appels : ${run.usage.calls} · jetons entrée ${run.usage.inputTokens} (dont cache ${run.usage.cachedInputTokens}) · sortie ${run.usage.outputTokens} · coût ${dollars(run.usage.costUsd)}`,
    );
    for (const step of run.usage.steps)
      lines.push(
        `    étape ${step.step} (${step.model}) : ${step.calls} appels, ${step.inputTokens} en entrée, ${step.outputTokens} en sortie, ${dollars(step.costUsd)}`,
      );
  }
  lines.push("");
  lines.push(`Coût total : ${dollars(report.costUsd)}`);
  if (report.pipelineLimits.length) {
    lines.push("");
    lines.push("Limites du pipeline mesuré :");
    for (const limit of report.pipelineLimits) lines.push(`  - ${limit}`);
  }
  lines.push("");
  lines.push(
    report.passed
      ? "VERDICT : seuils tenus à chaque passage, sur une mesure complète."
      : report.thresholdsHeld
        ? "VERDICT : seuils tenus sur ce qui a été mesuré. Mesure partielle : elle ne qualifie rien."
        : "VERDICT : seuils non tenus.",
  );
  return lines.join("\n");
}
