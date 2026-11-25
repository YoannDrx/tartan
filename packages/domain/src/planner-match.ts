import type {
  PlannerMatch,
  PlannerMatchGeneration,
  PlannerMatchJudgement,
  PlannerMatchRelation,
  PlannerSlotSuggestion,
} from "@tartan/contracts";
import { normalizeExerciseMention, normalizeExerciseTerm } from "./exercise-aliases";

// Étape « Retrouver » : à chaque mouvement cité par le coach, une fiche de la bibliothèque, ou aucune.
// Les règles passent d'abord, sans modèle : alias appris de l'espace, nom exact, alias exact. Ce qui reste part
// au modèle avec la bibliothèque. Rien ici ne choisit une fiche par ressemblance.

export type PlannerMatchExercise = {
  token: string;
  name: string;
  aliases: readonly string[];
  family?: string | null;
  // Fiche de l'espace (créée ou copiée par le coach) : elle passe devant une fiche commune du même nom.
  own?: boolean;
};
export type PlannerLearnedAlias = { term: string; token: string };
type Movement = { id: string; said: string };

// Déterminants et possessifs de tête : « ma routine épaules », « un peu de gainage », « nos fentes ».
const LEADING =
  /^(?:(?:le|la|les|l|un|une|des|du|de|d|mes|nos|tes|vos|ses|ma|mon|ta|ton|sa|son|notre|votre|leur|leurs|ce|cet|cette|ces|quelques|peu)\s+)+/;
// Une quantité dite devant le nom (« 10 pompes ») n'en fait pas partie ; un nom qui commence par deux nombres
// (« 90/90 ») les garde.
const LEADING_COUNT = /^\d+\s+(?=[a-z])/;
const NUMBER_WORDS: Record<string, string> = {
  deux: "2",
  trois: "3",
  quatre: "4",
  cinq: "5",
  six: "6",
  sept: "7",
  huit: "8",
  neuf: "9",
  dix: "10",
  // « trois » a déjà perdu son « s » de pluriel apparent.
  troi: "3",
};
/**
 * La clé d'un terme dit : sans accent, sans casse, sans pluriel, sans ponctuation ni déterminant de tête, les
 * petits nombres en chiffres. C'est sous cette clé qu'un alias appris est rangé et relu. « Les fentes sautées » et
 * « fente sautée » donnent la même ; « talons fesses » et « talons-fesses », « 90 90 » et « 90/90 », « trois
 * appuis » et « 3 appuis » aussi.
 */
export const plannerTermKey = (said: string) =>
  normalizeExerciseMention(said.replace(/[:;,.!?()«»"“”/\\+&]/g, " "))
    .replace(/[a-z]+/g, (word) => NUMBER_WORDS[word] ?? word)
    .replace(LEADING, "")
    .replace(LEADING_COUNT, "")
    .replace(LEADING, "")
    .trim();

const order = (a: PlannerMatchExercise, b: PlannerMatchExercise) =>
  Number(Boolean(b.own)) - Number(Boolean(a.own)) || a.token.localeCompare(b.token, "en", { numeric: true });

/**
 * Les règles, dans l'ordre : alias appris de l'espace, nom exact, alias exact. Un terme que plusieurs fiches
 * portent au même rang n'est pas tranché en silence : la première est posée « probable », les autres proposées.
 */
export function plannerRuleMatches(
  movements: readonly Movement[],
  exercises: readonly PlannerMatchExercise[],
  learned: readonly PlannerLearnedAlias[] = [],
): { matches: PlannerMatch[]; remaining: Movement[] } {
  const known = new Set(exercises.map((exercise) => exercise.token));
  const learnedByKey = new Map<string, string>();
  for (const alias of learned) if (known.has(alias.token)) learnedByKey.set(plannerTermKey(alias.term), alias.token);
  const names = new Map<string, PlannerMatchExercise[]>();
  const aliases = new Map<string, PlannerMatchExercise[]>();
  const add = (map: Map<string, PlannerMatchExercise[]>, label: string, exercise: PlannerMatchExercise) => {
    const key = plannerTermKey(label);
    if (!key) return;
    const list = map.get(key) ?? [];
    if (!list.includes(exercise)) list.push(exercise);
    map.set(key, list);
  };
  for (const exercise of exercises) {
    add(names, exercise.name, exercise);
    for (const alias of exercise.aliases) add(aliases, alias, exercise);
    // « Gammes : talons-fesses » se dit aussi « talons-fesses » : ce qui suit les deux-points vaut un alias.
    const tail = exercise.name.includes(":") ? exercise.name.slice(exercise.name.indexOf(":") + 1) : "";
    if (tail.trim()) add(aliases, tail, exercise);
  }
  const matches: PlannerMatch[] = [];
  const remaining: Movement[] = [];
  for (const movement of movements) {
    const key = plannerTermKey(movement.said);
    const base = { id: movement.id, said: movement.said };
    const taught = key ? learnedByKey.get(key) : undefined;
    if (taught) {
      matches.push({ ...base, confidence: "exact", exerciseToken: taught, alternatives: [], source: "learned" });
      continue;
    }
    const named = key ? [...(names.get(key) ?? [])].sort(order) : [];
    const aliased = key ? [...(aliases.get(key) ?? [])].filter((e) => !named.includes(e)).sort(order) : [];
    const [source, found] = named.length ? (["name", named] as const) : (["alias", aliased] as const);
    if (!found.length) {
      remaining.push(movement);
      continue;
    }
    // Une seule fiche, ou une seule fiche de l'espace devant des fiches communes : le terme la désigne.
    const single = found.length === 1 || (found[0]!.own && !found[1]!.own);
    matches.push({
      ...base,
      confidence: single ? "exact" : "probable",
      exerciseToken: found[0]!.token,
      alternatives: single ? [] : found.slice(1, 4).map((exercise) => exercise.token),
      source,
    });
  }
  return { matches, remaining };
}

const NEUTRAL = new Set(
  "avec sans pour sur sous dans par les des une aux puis fois serie series tour tours repetition repetitions rep reps".split(
    " ",
  ),
);
// Un nombre de deux chiffres ou plus fait partie d'un nom (« 90/90 », « 30-30 ») : il compte comme un mot.
const wordsOf = (label: string) =>
  normalizeExerciseMention(label)
    .split(/[^a-z0-9]+/)
    .filter((word) => (/^\d+$/.test(word) ? word.length > 1 : word.length > 2 && !NEUTRAL.has(word)));

/** Au-delà de cette taille, la bibliothèque est préfiltrée avant de partir au modèle. */
export const PLANNER_MATCH_FULL_LIBRARY = 600;

/**
 * Bibliothèque de plus de 600 fiches : préfiltre par mots et par famille. Une fiche qui partage un mot avec un
 * terme n'est jamais écartée, même au-delà de la limite ; le reste de la place va aux familles de ces fiches,
 * puis aux autres, à parts égales. En dessous de la limite, toute la bibliothèque passe.
 */
export function plannerMatchShortlist<T extends PlannerMatchExercise>(
  terms: readonly string[],
  exercises: readonly T[],
  limit = PLANNER_MATCH_FULL_LIBRARY,
): T[] {
  if (exercises.length <= limit) return [...exercises];
  const wanted = new Set(terms.flatMap(wordsOf));
  const sharing = exercises.filter((exercise) =>
    [exercise.name, ...exercise.aliases].some((label) => wordsOf(label).some((word) => wanted.has(word))),
  );
  const kept = new Set<T>(sharing);
  const families = new Set(sharing.map((exercise) => exercise.family ?? null));
  const rest = exercises.filter((exercise) => !kept.has(exercise));
  // D'abord les familles déjà touchées par les termes, puis les autres, une fiche par famille à chaque tour.
  for (const pool of [
    rest.filter((exercise) => families.has(exercise.family ?? null)),
    rest.filter((exercise) => !families.has(exercise.family ?? null)),
  ]) {
    const queues = new Map<string | null, T[]>();
    for (const exercise of [...pool].sort(order)) {
      const family = exercise.family ?? null;
      queues.set(family, [...(queues.get(family) ?? []), exercise]);
    }
    while (kept.size < limit && [...queues.values()].some((queue) => queue.length))
      for (const queue of queues.values()) {
        const next = queue.shift();
        if (next && kept.size < limit) kept.add(next);
      }
  }
  return exercises.filter((exercise) => kept.has(exercise));
}

/**
 * De quoi préremplir la création d'une fiche absente. Le nom est toujours celui du coach, nettoyé : une majuscule,
 * ni quantité ni charge. Sans proposition du modèle, les valeurs les plus prudentes : renforcement, poids du corps.
 */
export function plannerSlotDefaults(said: string, proposed: PlannerSlotSuggestion | null): PlannerSlotSuggestion {
  const clean = (value: string) =>
    value
      .replace(/\s+/g, " ")
      .replace(/^[\s,;:.–-]+|[\s,;:.–-]+$/g, "")
      .trim();
  const name = clean(proposed?.name ?? "") || clean(said) || said;
  return {
    name: (name.charAt(0).toLocaleUpperCase("fr") + name.slice(1)).slice(0, 120),
    category: proposed?.category ?? "strength",
    movement: proposed?.movement ?? "other",
    loadKind: proposed?.loadKind ?? "bodyweight",
  };
}

const RELATION_RANK: Record<PlannerMatchRelation, number> = { same_name: 0, same_known: 1, variant: 2, neighbor: 3 };
/**
 * La confiance se décide par règle, pas par le modèle. Il dit, pour chaque fiche qu'il propose, sa relation au
 * terme du coach ; la meilleure relation tranche :
 * - `same_name`, sans autre fiche donnée pour le même mouvement : `sure`. Le nom, un alias ou leur traduction
 *   directe portent l'équivalence.
 * - `same_known` (seule la connaissance du modèle la porte), `variant` (même geste à une précision près), ou deux
 *   fiches données pour le même mouvement : `probable`, donc posée avec la marque « À vérifier » et les autres
 *   fiches possibles.
 * - rien que des fiches voisines, ou rien : `absent`. Les voisines restent proposées au coach.
 * Les règles sans modèle (terme appris, nom ou alias exact) passent avant : ce verdict ne vaut que pour le reste.
 */
export function plannerMatchVerdict(judgement: PlannerMatchJudgement): PlannerMatchGeneration {
  return {
    matches: judgement.matches.map(({ id, candidates, suggestion }) => {
      const distinct = candidates.filter(
        (candidate, index) => candidates.findIndex((other) => other.key === candidate.key) === index,
      );
      // À relation égale, l'ordre du modèle vaut : il met la fiche la plus simple et la plus courante d'abord.
      const ordered = distinct
        .map((candidate, index) => ({ ...candidate, index }))
        .sort((a, b) => RELATION_RANK[a.relation] - RELATION_RANK[b.relation] || a.index - b.index);
      const best = ordered[0];
      if (!best || best.relation === "neighbor")
        return { id, confidence: "absent", key: null, others: ordered.slice(0, 3).map((c) => c.key), suggestion };
      const rival = ordered[1]?.relation === "same_name" || ordered[1]?.relation === "same_known";
      const sure = best.relation === "same_name" && !rival;
      return {
        id,
        confidence: sure ? "sure" : "probable",
        key: best.key,
        others: ordered.slice(1, 4).map((candidate) => candidate.key),
        suggestion: null,
      };
    }),
  };
}

/**
 * La réponse du modèle, vérifiée : une clé inconnue vaut « absent », une fiche choisie n'est jamais répétée dans
 * les autres propositions, un mouvement oublié reste absent. `keys` relie la clé courte donnée au modèle au jeton.
 */
export function plannerModelMatches(
  movements: readonly Movement[],
  generation: PlannerMatchGeneration,
  keys: ReadonlyMap<string, string>,
  equipmentByKey?: ReadonlyMap<string, readonly string[] | null>,
): PlannerMatch[] {
  const answers = new Map(generation.matches.map((match) => [match.id, match]));
  return movements.map((movement) => {
    const answer = answers.get(movement.id);
    const token = answer?.key ? (keys.get(answer.key) ?? null) : null;
    const others = [...new Set((answer?.others ?? []).flatMap((key) => (keys.has(key) ? [keys.get(key)!] : [])))]
      .filter((other) => other !== token)
      .slice(0, 3);
    // Un appui glissant définit la mécanique du geste. Une suggestion du modèle
    // sur la seule flexion du genou reste proposée sans inscrire un autre mouvement.
    const said = normalizeExerciseTerm(movement.said);
    const sliding = /\b(?:patins?|serviettes?|gliss[a-z]*|couliss[a-z]*|slid[a-z]*)\b/;
    const withoutSliding = /\b(?:sans|without|pas de) (?:(?:les|des|aucun|aucune) )?(?:patins?|serviettes?|gliss[a-z]*|couliss[a-z]*|slid[a-z]*)\b/;
    const missingSupport =
      answer?.key &&
      equipmentByKey?.get(answer.key)?.includes("sliders") &&
      (!sliding.test(said) || withoutSliding.test(said));
    if (!answer || answer.confidence === "absent" || !token || missingSupport)
      return {
        id: movement.id,
        said: movement.said,
        confidence: "absent" as const,
        exerciseToken: null,
        // Les fiches voisines restent proposées au coach, sans être posées dans la séance.
        alternatives: [...(token ? [token] : []), ...others].slice(0, 3),
        source: "none" as const,
        suggestion: plannerSlotDefaults(movement.said, answer?.suggestion ?? null),
      };
    return {
      id: movement.id,
      said: movement.said,
      confidence: answer.confidence,
      exerciseToken: token,
      alternatives: others,
      source: "model" as const,
    };
  });
}
