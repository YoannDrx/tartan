import { normalizeExerciseTerm } from "./exercise-aliases";
import { plannerEquipmentAvailable } from "./planner-equipment";

type Candidate = { id: string; name: string; aliases?: readonly string[] };
const words = (text: string) =>
  normalizeExerciseTerm(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2);

/**
 * Les fiches les plus proches d'un nom, pour l'écran où le coach choisit lui-même. Recherche seulement : un nom
 * voisin est une proposition, jamais un remplacement automatique. Le planificateur ne s'en sert plus pour couper
 * la bibliothèque : chaque mouvement cité est cherché dans toutes les fiches (`planner-match.ts`).
 */
export function rankPlannerCandidates<T extends Candidate>(exercises: readonly T[], text: string, limit: number): T[] {
  const normalized = ` ${words(text).join(" ")} `;
  const tokens = new Set(words(text));
  const score = (exercise: T) =>
    Math.max(
      ...[exercise.name, ...(exercise.aliases ?? [])].map((name) => {
        const parts = words(name);
        if (!parts.length) return 0;
        const exact = normalized.includes(` ${parts.join(" ")} `);
        return (exact ? 1000 + parts.length : 0) + parts.filter((word) => tokens.has(word)).length / parts.length;
      }),
    );
  return exercises
    .map((exercise) => ({ exercise, score: score(exercise) }))
    .sort((a, b) => b.score - a.score || a.exercise.id.localeCompare(b.exercise.id))
    .slice(0, Math.max(0, limit))
    .map(({ exercise }) => exercise);
}

export type PlannerLevel = "beginner" | "intermediate" | "advanced";
export type PlannerProposable = {
  token: string;
  family?: string | null;
  level?: PlannerLevel | null;
  // Matériel de la fiche : liste vide, aucun matériel ; null, inconnu (la fiche n'est alors jamais proposée).
  equipment?: readonly string[] | null;
  // Fiche commune relue par Tartan, ou copie d'une fiche relue.
  approved?: boolean;
  // Fiche créée par le coach dans son espace.
  own?: boolean;
  // Rang parmi les favoris et les listes du coach (0 : en tête) ; null hors de ses listes.
  preferred?: number | null;
};
export type PlannerProposalCriteria = {
  equipment: readonly string[];
  families: readonly string[];
  level: PlannerLevel | null;
};
export const PLANNER_CANDIDATES_MIN = 20;
export const PLANNER_CANDIDATES_MAX = 40;
const LEVELS: PlannerLevel[] = ["beginner", "intermediate", "advanced"];
// Échauffement et retour au calme : quelques fiches de ces familles accompagnent toujours les familles visées.
const AROUND = ["warmup", "mobility"];
const AROUND_COUNT = 6;

/**
 * Les 20 à 40 fiches données au modèle pour la partie qu'il compose. Règles seulement : fiches relues et fiches
 * du coach, dont tout le matériel est disponible, au niveau demandé ou en dessous, dans les familles visées ;
 * favoris et listes du coach d'abord. Sous 20 fiches, les familles voisines puis le niveau au-dessus complètent.
 */
export function selectPlannerCandidates<T extends PlannerProposable>(
  exercises: readonly T[],
  criteria: PlannerProposalCriteria,
  max = PLANNER_CANDIDATES_MAX,
): T[] {
  const rank = (exercise: T) => exercise.preferred ?? Number.POSITIVE_INFINITY;
  const sorted = (list: readonly T[]) =>
    [...list].sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Number(Boolean(b.own)) - Number(Boolean(a.own)) ||
        a.token.localeCompare(b.token, "en", { numeric: true }),
    );
  const usable = exercises.filter(
    (exercise) =>
      (exercise.approved || exercise.own) &&
      plannerEquipmentAvailable({ movement: null, equipment: exercise.equipment ?? null }, criteria.equipment),
  );
  const ceiling = criteria.level ? LEVELS.indexOf(criteria.level) : LEVELS.length - 1;
  const atLevel = usable.filter((exercise) => !exercise.level || LEVELS.indexOf(exercise.level) <= ceiling);
  const wanted = new Set(criteria.families);
  // Une fiche par famille à chaque tour : aucune famille visée n'est écrasée par une autre, plus fournie.
  const spread = (list: readonly T[], room: number): T[] => {
    const queues = new Map<string | null, T[]>();
    for (const exercise of sorted(list)) {
      const family = exercise.family ?? null;
      queues.set(family, [...(queues.get(family) ?? []), exercise]);
    }
    const taken: T[] = [];
    while (taken.length < room && [...queues.values()].some((queue) => queue.length))
      for (const queue of queues.values()) {
        const next = queue.shift();
        if (next && taken.length < room) taken.push(next);
      }
    return taken;
  };
  const picked: T[] = [];
  const add = (list: readonly T[], room: number) => {
    for (const exercise of spread(
      list.filter((candidate) => !picked.includes(candidate)),
      room,
    ))
      picked.push(exercise);
  };
  if (wanted.size) {
    const around = AROUND.filter((family) => !wanted.has(family));
    add(
      atLevel.filter((exercise) => wanted.has(exercise.family ?? "")),
      max - (around.length ? AROUND_COUNT : 0),
    );
    add(
      atLevel.filter((exercise) => around.includes(exercise.family ?? "")),
      Math.min(AROUND_COUNT, max - picked.length),
    );
  } else add(atLevel, max);
  // Trop peu de fiches : les autres familles au même niveau, puis le niveau au-dessus, sans jamais lever le matériel.
  if (picked.length < PLANNER_CANDIDATES_MIN) add(atLevel, PLANNER_CANDIDATES_MIN - picked.length);
  if (picked.length < PLANNER_CANDIDATES_MIN) add(usable, PLANNER_CANDIDATES_MIN - picked.length);
  return picked.slice(0, max);
}
