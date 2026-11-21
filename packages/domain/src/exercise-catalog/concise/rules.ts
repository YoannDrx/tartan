import type { ExerciseGuide } from "@tartan/contracts";

/**
 * La version concise d'un guide : ce que l'athlète lit d'un coup d'œil, entre deux séries.
 * Une phrase d'objectif, la mise en place en une ligne, une ligne par position du geste, deux ou trois erreurs,
 * et les variantes plus facile et plus difficile. Les longueurs se comptent en signes, espaces compris.
 */
export type ConciseDraft = {
  objective: string;
  setup: string;
  /** Autant d'étapes que le guide complet : chaque étape reste une position du geste animé. */
  steps: [string, string, ...string[]];
  mistakes: [string, string, ...string[]];
  easier: string | null;
  /** Clé de la fiche du catalogue qui décrit la variante plus facile, quand elle existe. */
  easierKey?: string;
  harder: string | null;
  harderKey?: string;
};

export type ConciseCatalog = Record<string, ConciseDraft>;

export const CONCISE_RULES = {
  objective: 70,
  setup: 80,
  step: 70,
  mistake: 55,
  variant: 50,
  /** Objectif, mise en place, étapes et erreurs réunis. */
  total: 380,
  mistakes: { min: 2, max: 3 },
} as const;

const length = (text: string) => [...text].length;
// Une ligne se lit seule : majuscule au début, ponctuation finale, pas de double espace ni de retour à la ligne.
const malformed = (text: string) =>
  !/^[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜ0-9]/u.test(text) || !/[.!?]$/u.test(text) || /\s{2}|\n/u.test(text);

/** Les écarts d'un guide concis à ses règles ; une liste vide quand il les respecte. */
export const conciseProblems = (
  key: string,
  full: Pick<ExerciseGuide, "steps">,
  concise: ConciseDraft,
  knownKeys: ReadonlySet<string>,
): string[] => {
  const problems: string[] = [];
  const check = (field: string, text: string, max: number) => {
    if (length(text) > max) problems.push(`${key} ${field} : ${length(text)} signes pour ${max}`);
    if (malformed(text)) problems.push(`${key} ${field} : phrase mal formée « ${text} »`);
  };
  check("objectif", concise.objective, CONCISE_RULES.objective);
  check("mise en place", concise.setup, CONCISE_RULES.setup);
  if (concise.steps.length !== full.steps.length)
    problems.push(`${key} : ${concise.steps.length} étapes pour ${full.steps.length} positions du geste`);
  concise.steps.forEach((step, index) => check(`étape ${index + 1}`, step, CONCISE_RULES.step));
  if (concise.mistakes.length < CONCISE_RULES.mistakes.min || concise.mistakes.length > CONCISE_RULES.mistakes.max)
    problems.push(`${key} : ${concise.mistakes.length} erreurs`);
  concise.mistakes.forEach((mistake, index) => check(`erreur ${index + 1}`, mistake, CONCISE_RULES.mistake));
  for (const [field, text, target] of [
    ["plus facile", concise.easier, concise.easierKey],
    ["plus difficile", concise.harder, concise.harderKey],
  ] as const) {
    if (text !== null) check(field, text, CONCISE_RULES.variant);
    if (target !== undefined && (target === key || !knownKeys.has(target)))
      problems.push(`${key} ${field} : fiche « ${target} » introuvable`);
    if (target !== undefined && text === null) problems.push(`${key} ${field} : fiche sans libellé`);
  }
  const total = [concise.objective, concise.setup, ...concise.steps, ...concise.mistakes].reduce(
    (sum, text) => sum + length(text),
    0,
  );
  if (total > CONCISE_RULES.total) problems.push(`${key} : ${total} signes au total pour ${CONCISE_RULES.total}`);
  return problems;
};
