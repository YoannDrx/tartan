// Options de la commande `eval:planner:e2e`, lues sans rien exécuter.
export type E2eOptions = {
  action: "run" | "check" | "freeze" | "catalog" | "summary";
  // Rapport à relire, pour `--summary`.
  summary: string | null;
  runs: number;
  model: string | null;
  fastModel: string | null;
  only: string[] | null;
  maxCostUsd: number | null;
  suite: "all" | "cases" | "pairs";
  concurrency: number;
  // Les six exemples du README à la place du corpus : ils ne servent jamais à la mesure.
  examples: boolean;
  corpus: string | null;
  pairs: string | null;
  output: string | null;
  databaseUrl: string | null;
};

const VALUED = new Set([
  "--summary",
  "--runs",
  "--model",
  "--fast-model",
  "--only",
  "--max-cost",
  "--suite",
  "--concurrency",
  "--corpus",
  "--pairs",
  "--output",
  "--database-url",
]);
const FLAGS = new Set(["--check", "--freeze", "--catalog", "--examples"]);

export class OptionError extends Error {}

export function parseOptions(argv: readonly string[]): E2eOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index++) {
    const name = argv[index]!;
    if (FLAGS.has(name)) flags.add(name);
    else if (VALUED.has(name)) {
      const value = argv[++index];
      if (value === undefined || value.startsWith("--")) throw new OptionError(`${name} attend une valeur.`);
      values.set(name, value);
    } else throw new OptionError(`Option inconnue : ${name}`);
  }
  const integer = (name: string, fallback: number, min: number, max: number) => {
    const raw = values.get(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max)
      throw new OptionError(`${name} attend un entier de ${min} à ${max}.`);
    return value;
  };
  const maxCost = values.get("--max-cost");
  if (maxCost !== undefined && !(Number(maxCost) > 0))
    throw new OptionError("--max-cost attend un montant en dollars.");
  const suite = values.get("--suite") ?? "all";
  if (suite !== "all" && suite !== "cases" && suite !== "pairs")
    throw new OptionError("--suite attend all, cases ou pairs.");
  const actions = [
    flags.has("--check") && "check",
    flags.has("--freeze") && "freeze",
    flags.has("--catalog") && "catalog",
    values.has("--summary") && "summary",
  ].filter(Boolean) as E2eOptions["action"][];
  if (actions.length > 1)
    throw new OptionError("Une seule action à la fois : --check, --freeze, --catalog ou --summary.");
  const only = values.get("--only");
  return {
    action: actions[0] ?? "run",
    summary: values.get("--summary") ?? null,
    runs: integer("--runs", 3, 1, 10),
    model: values.get("--model") ?? null,
    fastModel: values.get("--fast-model") ?? null,
    only: only
      ? only
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : null,
    maxCostUsd: maxCost === undefined ? null : Number(maxCost),
    suite,
    concurrency: integer("--concurrency", 3, 1, 8),
    examples: flags.has("--examples"),
    corpus: values.get("--corpus") ?? null,
    pairs: values.get("--pairs") ?? null,
    output: values.get("--output") ?? null,
    databaseUrl: values.get("--database-url") ?? null,
  };
}

/** La base de la mesure est jetable et locale : jamais une base hébergée, jamais celle du développement. */
export function assertEvalDatabase(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new OptionError("Adresse de base illisible.");
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))
    throw new OptionError("La mesure ne tourne que sur une base locale.");
  if (!/_eval$/.test(parsed.pathname.slice(1)))
    throw new OptionError("Le nom de la base de mesure doit finir par _eval (base jetable dédiée).");
  return url;
}
