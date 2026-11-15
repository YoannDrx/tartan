import { normalizeExerciseMention } from "./exercise-aliases";

// Passe déterministe avant le modèle : elle repère les fiches nommées exactement
// (nom ou alias, forme la plus longue) et les noms de mouvement inconnus placés
// devant une prescription (« Squat du dragon, trois séries de six »). Elle ne
// choisit jamais une fiche par ressemblance : un doute reste une question.

type MentionExercise = { token: string; name: string; aliases: readonly string[] };
type Resolution = { term: string; token: string };
export type PlannerMention = { term: string; token: string };

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Mots qui accompagnent une fiche sans changer le mouvement : contexte, côté,
// intensité, liaison. Les qualificatifs de direction, prise et matériel restent
// significatifs et font de la fiche une autre variante.
const NEUTRAL = new Set(
  (
    "a au aux avec chaque chacun chacune cote cotes de des du en et la le les leger legere lent lente lourd lourde " +
    "par pour puis rapide sans sur un une ensuite enfin explosif explosive tempo controle strict stricte pause " +
    "jambe jambes bras main mains serie groupe le groupe seance poids corps charge ajoutee travail exercice " +
    "lundi mardi mercredi jeudi vendredi samedi dimanche demain aujourd hui matin soir " +
    "janvier fevrier mars avril mai juin juillet aout septembre octobre novembre decembre " +
    "deux trois quatre cinq six sept huit neuf dix douze quinze vingt trente"
  )
    .split(/\s+/)
    .map(normalizeExerciseMention),
);
// Un nombre seul (date, repère) ou une lettre de circuit (« A », « B ») ne nomme pas un mouvement.
const isNeutral = (word: string) => NEUTRAL.has(word) || /^\d+$/.test(word) || word.length === 1;

const NUMBER_WORDS =
  "un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante|cent";
const QUANTITY = `(?:\\d+|${NUMBER_WORDS})`;
// Clause de prescription : « 3 séries de 6 », « trois fois huit », « 4 x 5 », « 6 passages ».
const PRESCRIPTION = new RegExp(
  `^(?:${QUANTITY})(?:[- ](?:${NUMBER_WORDS}))*\\s*(?:x|×|\\*|fois|series?|passages?|tours?|maintiens?|repetitions?|reps?)(?![a-z])`,
);
// Clause qui décrit une quantité, une durée, une charge ou une consigne, jamais un mouvement.
const NOT_A_MOVEMENT = new RegExp(
  `(?:\\d+\\s*(?:kg|kilos?|m|metres?|s|sec|secondes?|min|minutes?|%|pour ?cent)\\b)|(?:^(?:recup|recuperation|repos|sans|aucun|aucune|avec|charge|barre|ballon|puis|ensuite|superset|circuit|repeter|apres|entre|tempo)\\b)`,
);

const plain = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/[’‘]/g, "'");

function labelsOf(exercises: readonly MentionExercise[], resolutions: readonly Resolution[]) {
  const labels = new Map<string, Set<string>>();
  for (const exercise of exercises)
    for (const label of [exercise.name, ...exercise.aliases]) {
      const key = normalizeExerciseMention(label);
      if (key) labels.set(key, new Set([...(labels.get(key) ?? []), exercise.token]));
    }
  for (const choice of resolutions) {
    const key = normalizeExerciseMention(choice.term);
    if (key && exercises.some((exercise) => exercise.token === choice.token)) labels.set(key, new Set([choice.token]));
  }
  return labels;
}

function spans(text: string, labels: Map<string, Set<string>>) {
  const hits: { start: number; end: number; term: string; tokens: Set<string> }[] = [];
  for (const [term, tokens] of labels)
    for (const match of text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}_])${escape(term)}(?![\\p{L}\\p{N}_])`, "gu")))
      hits.push({ start: match.index, end: match.index + match[0].length, term, tokens });
  // Le nom le plus long l'emporte : « squat avant » n'est pas « squat ».
  return hits.filter(
    (hit) =>
      !hits.some(
        (other) =>
          other !== hit && other.start <= hit.start && other.end >= hit.end && other.end - other.start > hit.end - hit.start,
      ),
  );
}

/** Fiches désignées sans ambiguïté par leur nom complet ou un alias unique. */
export function plannerExerciseMentions(
  text: string,
  exercises: readonly MentionExercise[],
  resolutions: readonly Resolution[] = [],
): PlannerMention[] {
  const found = new Map<string, PlannerMention>();
  const hits = spans(normalizeExerciseMention(text), labelsOf(exercises, resolutions)).sort((a, b) => a.start - b.start);
  for (const hit of hits)
    if (hit.tokens.size === 1) found.set(hit.term, { term: hit.term, token: [...hit.tokens][0]! });
  return [...found.values()];
}

/**
 * Noms de mouvement placés juste avant une prescription et qu'aucune fiche
 * n'explique entièrement. « Squat du dragon » reste inconnu même si « squat »
 * existe : un mot significatif non couvert suffit.
 */
export function plannerUnknownExerciseTerms(
  text: string,
  exercises: readonly MentionExercise[],
  resolutions: readonly Resolution[] = [],
): string[] {
  const labels = labelsOf(exercises, resolutions);
  const unknown = new Map<string, string>();
  for (const line of text.split("\n")) {
    // La couverture se calcule sur la ligne entière : un nom de fiche peut contenir
    // une virgule, deux-points ou « avec » (« Gammes : montées de genoux »).
    const norm = normalizeExerciseMention(line);
    let masked = norm;
    for (const hit of spans(norm, labels))
      masked = `${masked.slice(0, hit.start)}${" ".repeat(hit.end - hit.start)}${masked.slice(hit.end)}`;
    const uncovered = (from: number, to: number) =>
      masked
        .slice(from, to)
        .split(/[^a-z0-9]+/)
        .filter((word) => word && !isNeutral(word));
    const clauses = line.split(/[,;:.!?()]|\s+(?:puis|ensuite)\s+/).map((clause) => clause.trim());
    let cursor = 0;
    clauses.forEach((clause, index) => {
      const own = normalizeExerciseMention(clause);
      const at = own ? norm.indexOf(own, cursor) : -1;
      if (at >= 0) cursor = at + own.length;
      const next = plain(clauses[index + 1] ?? "").trim();
      const raw = plain(clause).trim();
      if (!clause || at < 0 || !PRESCRIPTION.test(next) || PRESCRIPTION.test(raw) || NOT_A_MOVEMENT.test(raw)) return;
      if (!uncovered(at, at + own.length).length) return;
      // « Fentes avant avec deux haltères de 20 » : le matériel ou la charge relèvent du modèle.
      const avec = clause.search(/\s+avec\s+/i);
      const head = avec > 0 ? normalizeExerciseMention(clause.slice(0, avec)) : "";
      if (head && norm.startsWith(head, at) && !uncovered(at, at + head.length).length) return;
      // Le nom cité commence au premier mot du mouvement : « lundi 3 juin squat du dragon ».
      const words = clause.split(/\s+/);
      while (words.length > 1 && isNeutral(normalizeExerciseMention(words[0]!))) words.shift();
      const name = words.join(" ").slice(0, 120);
      unknown.set(normalizeExerciseMention(name), name);
    });
  }
  return [...unknown.values()];
}
