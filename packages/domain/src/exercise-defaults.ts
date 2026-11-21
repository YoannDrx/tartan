import {
  exerciseCategory,
  exerciseLoadKind,
  type ExerciseCategory,
  type ExerciseFamily,
  type ExerciseLoadKind,
} from "@tartan/contracts";
import { normalizeExerciseMention, normalizeExerciseTerm } from "./exercise-aliases";

/** Ce que la création rapide propose pour une fiche, et d'où vient la proposition. */
export type ExerciseDefaults = {
  category: ExerciseCategory;
  strengthLoadKind: ExerciseLoadKind | null;
  basis: { kind: "exercise"; name: string } | { kind: "keyword"; word: string } | { kind: "default" };
};

type LibraryEntry = {
  name: string;
  aliases?: readonly string[];
  category: string;
  strengthLoadKind?: string | null;
};

// Sans fiche proche ni mot du métier : la famille la plus courante, et aucune convention de charge affirmée.
export const NEUTRAL_EXERCISE_DEFAULTS: ExerciseDefaults = {
  category: "strength",
  strengthLoadKind: null,
  basis: { kind: "default" },
};

const CATEGORIES: readonly string[] = exerciseCategory.options;
const LOAD_KINDS: readonly string[] = exerciseLoadKind.options;

// Les mots qui ne disent rien du geste.
const EMPTY_WORDS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "d",
  "dans",
  "de",
  "des",
  "du",
  "et",
  "l",
  "la",
  "le",
  "les",
  "ou",
  "par",
  "pour",
  "sans",
  "sous",
  "sur",
  "un",
  "une",
  "vers",
]);

/** Les mots qui portent le sens d'un nom d'exercice : sans accents, sans pluriel, sans article ni nombre. */
export const significantExerciseWords = (label: string): string[] => [
  ...new Set(
    normalizeExerciseMention(label)
      .split(/[^\p{L}\p{N}]+/u)
      // « genoux » et « genou » sont le même mot.
      .map((word) => (word.length > 4 ? word.replace(/([aeo]u)x$/, "$1") : word))
      .filter((word) => word.length > 1 && !EMPTY_WORDS.has(word) && !/^\p{N}+$/u.test(word)),
  ),
];

type Keyword = { stems: readonly string[]; category?: ExerciseCategory; loadKind?: ExerciseLoadKind | null };

/**
 * Les mots du métier, du plus précis au plus général. Un mot qui qualifie le geste (lesté, sauté) passe avant le
 * geste qu'il qualifie (squat) : « squat sauté » est de la pliométrie. Un radical de quatre lettres ou plus vaut
 * pour ses dérivés (saut, sauté, sauter) ; plus court, il doit être le mot entier.
 */
const KEYWORDS: readonly Keyword[] = [
  { stems: ["lest"], loadKind: "added_weight" },
  { stems: ["assist"], loadKind: "assistance" },
  { stems: ["echauffement", "activation", "reveil"], category: "warmup", loadKind: null },
  {
    stems: ["mobilit", "etirement", "stretch", "souplesse", "assouplissement", "automassage", "yoga"],
    category: "mobility",
    loadKind: null,
  },
  { stems: ["escalier", "gradin"], category: "stairs", loadKind: null },
  { stems: ["plot", "cone", "echelle", "slalom", "cerceau", "latte"], category: "cones", loadKind: null },
  { stems: ["longueur", "hauteur", "perche", "fosbury"], category: "jump", loadKind: null },
  {
    stems: ["saut", "bond", "rebond", "pliometri", "plyo", "multibond", "cloche", "jump", "cmj", "drop"],
    category: "plyo",
    loadKind: null,
  },
  {
    stems: ["sprint", "course", "courir", "foulee", "skipping", "talon", "griffe", "gamme", "acceleration", "footing"],
    category: "running_drill",
    loadKind: null,
  },
  {
    stems: ["pompe", "traction", "dip", "gainage", "planche", "abdo", "crunch", "burpee", "pistol", "chaise"],
    category: "strength",
    loadKind: "bodyweight",
  },
  {
    stems: [
      "squat",
      "souleve",
      "deadlift",
      "developpe",
      "presse",
      "rowing",
      "tirage",
      "curl",
      "fente",
      "thrust",
      "bench",
      "barre",
      "haltere",
      "kettlebell",
      "goblet",
      "epaule",
      "arrache",
      "jete",
      "clean",
      "snatch",
      "extension",
      "mollet",
      "swing",
    ],
    category: "strength",
    loadKind: "external_total",
  },
];

const matchesStem = (word: string, stem: string) => (stem.length >= 4 ? word.startsWith(stem) : word === stem);

// Ce que les mots du métier disent d'un nom : la famille du premier mot clé qui en donne une, la charge du premier
// qui en donne une.
const keywordDefaults = (words: readonly string[]) => {
  let category: { value: ExerciseCategory; word: string } | undefined;
  let loadKind: { value: ExerciseLoadKind | null; word: string } | undefined;
  for (const keyword of KEYWORDS) {
    const word = words.find((candidate) => keyword.stems.some((stem) => matchesStem(candidate, stem)));
    if (!word) continue;
    if (!category && keyword.category) category = { value: keyword.category, word };
    if (!loadKind && keyword.loadKind !== undefined) loadKind = { value: keyword.loadKind, word };
  }
  return { category, loadKind };
};

const asCategory = (value: string): ExerciseCategory | null =>
  CATEGORIES.includes(value) ? (value as ExerciseCategory) : null;
const asLoadKind = (value: string | null | undefined): ExerciseLoadKind | null =>
  value && LOAD_KINDS.includes(value) ? (value as ExerciseLoadKind) : null;

// La fiche la plus proche : celle qui partage le plus de mots significatifs avec le nom, à proportion de leurs
// longueurs. En dessous de la moitié, deux noms ne se ressemblent pas assez pour hériter l'un de l'autre.
const nearestExercise = (words: readonly string[], library: readonly LibraryEntry[]) => {
  type Match = { entry: LibraryEntry; score: number; shared: string[]; byName: boolean };
  const better = (a: Match, b: Match | undefined) =>
    !b ||
    a.score > b.score ||
    (a.score === b.score && a.shared.length > b.shared.length) ||
    (a.score === b.score && a.shared.length === b.shared.length && a.byName && !b.byName);
  const matches: Match[] = [];
  for (const entry of library) {
    if (!asCategory(entry.category)) continue;
    let own: Match | undefined;
    [entry.name, ...(entry.aliases ?? [])].forEach((label, index) => {
      const other = significantExerciseWords(label);
      const shared = words.filter((word) => other.includes(word));
      const score = shared.length === 0 ? 0 : (2 * shared.length) / (words.length + other.length);
      const match = { entry, score, shared, byName: index === 0 };
      if (score >= 0.5 && better(match, own)) own = match;
    });
    if (own) matches.push(own);
  }
  const top = matches.reduce<Match | undefined>((best, match) => (better(match, best) ? match : best), undefined);
  if (!top) return undefined;
  // Plusieurs fiches aussi proches : la famille la plus représentée parmi elles l'emporte, puis une fiche trouvée
  // par son nom plutôt que par un autre nom, puis l'ordre alphabétique. Un mot courant (« saut ») ne suffit pas
  // à faire hériter d'une fiche isolée.
  const tied = matches.filter((match) => match.score === top.score && match.shared.length === top.shared.length);
  const count = (category: string) => tied.filter((match) => match.entry.category === category).length;
  return [...tied].sort(
    (a, b) =>
      count(b.entry.category) - count(a.entry.category) ||
      Number(b.byName) - Number(a.byName) ||
      a.entry.name.localeCompare(b.entry.name, "fr"),
  )[0];
};

/**
 * La famille et la convention de charge proposées pour une fiche qu'on crée par son seul nom : celles de la fiche
 * la plus proche de la bibliothèque, puis ce que disent les mots du métier, sinon un défaut neutre. Un mot que la
 * fiche proche ne porte pas et qui change le geste (sauté, lesté) l'emporte sur elle. La proposition se corrige
 * d'un geste : elle n'affirme rien.
 */
export const suggestExerciseDefaults = (name: string, library: readonly LibraryEntry[]): ExerciseDefaults => {
  const words = significantExerciseWords(name);
  if (words.length === 0) return NEUTRAL_EXERCISE_DEFAULTS;
  const nearest = nearestExercise(words, library);
  if (nearest) {
    const extra = keywordDefaults(words.filter((word) => !nearest.shared.includes(word)));
    return {
      category: extra.category?.value ?? asCategory(nearest.entry.category)!,
      strengthLoadKind: extra.loadKind ? extra.loadKind.value : asLoadKind(nearest.entry.strengthLoadKind),
      basis: { kind: "exercise", name: nearest.entry.name },
    };
  }
  const found = keywordDefaults(words);
  if (!found.category && !found.loadKind) return NEUTRAL_EXERCISE_DEFAULTS;
  return {
    category: found.category?.value ?? NEUTRAL_EXERCISE_DEFAULTS.category,
    strengthLoadKind: found.loadKind ? found.loadKind.value : null,
    basis: { kind: "keyword", word: (found.category ?? found.loadKind)!.word },
  };
};

/** Une fiche de la bibliothèque qui porte déjà ce nom, sans tenir compte des accents ni des majuscules. */
export const findExerciseByName = <E extends { name: string }>(name: string, library: readonly E[]): E | null => {
  const key = normalizeExerciseTerm(name);
  if (!key) return null;
  return library.find((entry) => normalizeExerciseTerm(entry.name) === key) ?? null;
};

// La catégorie enregistrée d'une fiche écrite par le coach, pour une famille que le planificateur propose.
const categoryByFamily: Record<ExerciseFamily, ExerciseCategory> = {
  strength: "strength",
  weightlifting: "strength",
  core: "strength",
  mobility: "mobility",
  plyometrics: "plyo",
  running: "running_drill",
  coordination: "cones",
  stairs: "stairs",
  warmup: "warmup",
};

export const exerciseCategoryOfFamily = (family: ExerciseFamily): ExerciseCategory => categoryByFamily[family];
