// Mesure de bout en bout du planificateur : un espace jetable par cas, le service comme le fait la route, puis la
// notation, la latence, les jetons et le coût. Mode d'emploi : apps/web/evals/e2e/README.md.
//
//   eval:planner:e2e --check            contrôle le format et le gel, sans base ni réseau
//   eval:planner:e2e --freeze           écrit l'empreinte du corpus et du jeu de paires
//   eval:planner:e2e --catalog          liste les clés du catalogue commun, pour écrire des cas
//   eval:planner:e2e --summary <json>   relit un rapport, sans aucun appel
//   eval:planner:e2e [--runs 3] [--model m] [--fast-model m] [--only a,b] [--max-cost 5] [--suite all|cases|pairs]
//
// Sans clé OpenAI, ou avec AI_PLANNER_FAKE_PROVIDER=true, le prestataire est simulé et rien ne sort du poste.
// Avec une clé, la mesure est réelle et exige --max-cost : elle s'arrête net quand le coût cumulé le dépasse.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import dotenv from "dotenv";
import { EXERCISE_CATALOG } from "@tartan/domain/exercise-catalog";
import {
  FreezeError,
  freezeFile,
  frozenHash,
  loadFrozenCorpus,
  loadFrozenPairs,
  validateCorpus,
  validatePairs,
} from "../evals/e2e/freeze";
import { assertEvalDatabase, OptionError, parseOptions } from "../evals/e2e/options";
import { finalize, renderSummary, type E2eReport } from "../evals/e2e/report";
import { runE2e } from "../evals/e2e/runner";

const root = resolve(import.meta.dirname, "../../..");
const web = resolve(import.meta.dirname, "..");
const DEFAULT_DATABASE = "postgresql://tartan@localhost:54329/tartan_planner_e2e_eval";

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const folder = resolve(web, "evals/e2e");
  // --dev : le jeu de développement, non gelé, qui sert à mettre au point et ne qualifie jamais rien.
  const file = (given: string | null, examples: string, dev: string, real: string) =>
    given ? resolve(root, given) : resolve(folder, options.dev ? dev : options.examples ? examples : real);
  const corpusFile = file(options.corpus, "corpus/examples.json", "dev/cases.json", "corpus/cases.json");
  const pairsFile = file(options.pairs, "pairs/examples.json", "dev/pairs.json", "pairs/pairs.json");
  const shown = (path: string) => relative(root, path);

  if (options.action === "catalog") {
    // Pour qui écrit des cas : les clés acceptées dans `key`, sans lire ni le prompt ni les garde-fous.
    for (const entry of EXERCISE_CATALOG)
      console.log(
        [
          entry.catalogKey,
          entry.name,
          entry.guide.family,
          (entry.classification.equipment ?? []).join("+") || "aucun matériel",
          (entry.aliases ?? []).join(" | "),
        ].join("\t"),
      );
    return;
  }

  if (options.action === "summary") {
    const saved = JSON.parse(readFileSync(resolve(root, options.summary!), "utf8")) as E2eReport;
    // Recalculé depuis les lignes : un rapport retouché à la main ne garde pas son verdict.
    const report = finalize(saved);
    console.log(renderSummary(report));
    if (!report.thresholdsHeld) process.exitCode = 1;
    return;
  }

  if (options.action === "check" || options.action === "freeze") {
    // Jamais une consigne à l'écran : des comptes, des empreintes et des problèmes nommés par identifiant.
    let failed = false;
    for (const [name, path, validate, skipped] of [
      ["corpus", corpusFile, validateCorpus, options.suite === "pairs"],
      ["paires", pairsFile, validatePairs, options.suite === "cases"],
    ] as const) {
      if (skipped) continue;
      if (!existsSync(path)) {
        // Rien à contrôler n'est pas un contrôle réussi.
        failed = true;
        console.log(JSON.stringify({ file: shown(path), name, present: false }));
        continue;
      }
      const checked = validate(path);
      const count = "corpus" in checked ? checked.corpus.cases.length : checked.pairs.pairs.length;
      const frozen = frozenHash(path);
      if (checked.problems.length) failed = true;
      if (options.action === "freeze" && !checked.problems.length) freezeFile(path);
      else if (frozen && frozen !== checked.hash) failed = true;
      console.log(
        JSON.stringify({
          file: shown(path),
          name,
          present: true,
          count,
          hash: checked.hash,
          frozen: options.action === "freeze" && !checked.problems.length ? "écrit" : frozen === checked.hash,
          changedSinceFreeze: Boolean(frozen && frozen !== checked.hash),
          problems: checked.problems,
        }),
      );
    }
    if (failed) process.exitCode = 1;
    return;
  }

  // Un corpus sans empreinte, ou modifié depuis son gel, est refusé avant toute dépense.
  // Le jeu de développement se charge sans gel : il change pendant la mise au point, et le rapport le dit.
  const loadCorpus = (path: string) => {
    if (!options.dev) return loadFrozenCorpus(path);
    const { corpus: loaded, hash, problems } = validateCorpus(path);
    if (problems.length) throw new FreezeError("invalid", path, problems.slice(0, 8).join(" ; "));
    return { corpus: loaded, hash };
  };
  const loadPairs = (path: string) => {
    if (!options.dev) return loadFrozenPairs(path);
    const { pairs: loaded, hash, problems } = validatePairs(path);
    if (problems.length) throw new FreezeError("invalid", path, problems.slice(0, 8).join(" ; "));
    return { pairs: loaded, hash };
  };
  const corpus = options.suite === "pairs" ? null : { file: shown(corpusFile), ...loadCorpus(corpusFile) };
  const pairs = options.suite === "cases" ? null : { file: shown(pairsFile), ...loadPairs(pairsFile) };

  const localPath = resolve(root, ".env.local");
  const local = existsSync(localPath) ? dotenv.parse(readFileSync(localPath)) : {};
  const key =
    process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY || local.OPENAI_API_KEY || local.OPEN_AI_API_KEY;
  const fake = process.env.AI_PLANNER_FAKE_PROVIDER === "true" || !key;
  if (!fake && options.maxCostUsd === null)
    throw new OptionError(
      "Une clé OpenAI est présente : la mesure réelle exige --max-cost <dollars>. Pour le prestataire simulé : AI_PLANNER_FAKE_PROVIDER=true.",
    );
  // Les défauts du serveur (src/lib/env.ts) : le modèle principal compose et répare, le rapide comprend et retrouve.
  const model = options.model ?? process.env.AI_PLANNER_MODEL ?? local.AI_PLANNER_MODEL ?? "gpt-6.2-sol";
  const fastModel =
    options.fastModel ?? process.env.AI_PLANNER_FAST_MODEL ?? local.AI_PLANNER_FAST_MODEL ?? "gpt-6.1-terra";
  const databaseUrl = assertEvalDatabase(options.databaseUrl ?? process.env.EVAL_DATABASE_URL ?? DEFAULT_DATABASE);
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPEN_AI_API_KEY;
  // Aucun e-mail ne part d'une mesure : les espaces jetables n'ont que des adresses fictives.
  delete process.env.RESEND_API_KEY;
  // Créer un espace tente l'e-mail de bienvenue, qui ne se rend pas hors de Next : un avertissement par cas, sans
  // intérêt ici.
  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes('"welcome_email_failed"')) return;
    warn(...args);
  };
  Object.assign(process.env, {
    ...(fake ? { AI_PLANNER_FAKE_PROVIDER: "true" } : { OPENAI_API_KEY: key, AI_PLANNER_FAKE_PROVIDER: "false" }),
    AI_PLANNER_MODEL: model,
    AI_PLANNER_FAST_MODEL: fastModel,
    AI_PLANNER_ENABLED: "true",
    DATABASE_URL: databaseUrl,
    DATABASE_URL_UNPOOLED: databaseUrl,
    BETTER_AUTH_SECRET: "synthetic-planner-evaluation-local-only-secret",
    BETTER_AUTH_URL: "http://localhost:3102",
    NEXT_PUBLIC_APP_URL: "http://localhost:3102",
    COACH_SIGNUP_MODE: "public",
  });
  // Le schéma à jour, sans rien effacer : chaque cas crée son propre espace.
  execFileSync("corepack", ["pnpm", "exec", "prisma", "migrate", "deploy"], {
    cwd: web,
    env: process.env,
    stdio: "pipe",
  });

  const output = resolve(
    root,
    options.output ?? `.local/planner-e2e-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  if (existsSync(output))
    throw new OptionError("Le fichier de rapport existe déjà : une mesure ne remplace pas la précédente.");
  mkdirSync(dirname(output), { recursive: true });
  const progress = `${output}.lignes.jsonl`;

  // Chargé après les variables : le service lit l'environnement à l'import.
  const { createServiceDriver } = await import("../evals/e2e/driver");
  const { prisma } = await import("../src/lib/prisma");
  const driver = createServiceDriver();
  let report: E2eReport;
  try {
    report = await runE2e({
      corpus,
      pairs,
      driver,
      options: {
        runs: options.runs,
        only: options.only ?? undefined,
        suite: options.suite,
        maxCostUsd: options.maxCostUsd,
        concurrency: options.concurrency,
        onRow: (row) => {
          // Chaque ligne est gardée aussitôt : une mesure interrompue ne perd pas ce qu'elle a payé.
          appendFileSync(progress, `${JSON.stringify(row)}\n`, { mode: 0o600 });
          console.log(
            JSON.stringify(
              row.suite === "case"
                ? {
                    run: row.run,
                    case: row.id,
                    passed: row.score.passed,
                    differences: row.score.differences,
                    critical: row.score.critical,
                    costUsd: row.costUsd,
                  }
                : {
                    run: row.run,
                    pair: row.id,
                    top1: row.score.top1,
                    top3: row.score.top3,
                    falsePositive: row.score.falsePositive,
                    error: row.error,
                    costUsd: row.costUsd,
                  },
            ),
          );
        },
      },
      meta: {
        commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
        model: fake ? "simulé" : model,
        fastModel: fake ? null : fastModel,
        examples: options.examples,
        dev: options.dev,
      },
    });
  } finally {
    driver.close();
    await prisma.$disconnect();
  }
  writeFileSync(`${output}.tmp`, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  renameSync(`${output}.tmp`, output);
  const summary = renderSummary(report);
  writeFileSync(output.replace(/\.json$/, "") + ".txt", `${summary}\n`, { mode: 0o600 });
  console.log(`\n${summary}\n\nRapport : ${shown(output)}`);
  if (!report.thresholdsHeld) process.exitCode = 1;
}

main()
  .catch((cause: unknown) => {
    // Ni clé, ni corps de réponse du fournisseur, ni consigne : seulement la raison de l'arrêt.
    const reason =
      cause instanceof OptionError || cause instanceof FreezeError
        ? cause.message
        : cause instanceof Error && /^(unknown_ids|nothing_to_measure|invalid_)/.test(cause.message)
          ? cause.message
          : "erreur interne (E2E_EVAL_DEBUG=1 pour le détail)";
    console.error(`Mesure de bout en bout arrêtée : ${reason}`);
    if (process.env.E2E_EVAL_DEBUG === "1") console.error(cause);
    process.exitCode = 1;
  })
  // Les connexions ouvertes par les services ne retiennent pas la commande.
  .finally(() => process.exit(process.exitCode ?? 0));
