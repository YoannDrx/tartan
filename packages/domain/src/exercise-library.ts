import type { ExerciseCategory, ExerciseFamily } from "@tartan/contracts";
import { normalizeExerciseTerm } from "./exercise-aliases";

// La famille d'une fiche : celle de son guide ; à défaut, celle que sa catégorie désigne. Une fiche écrite par le
// coach, sans guide, se range ainsi avec les fiches du même geste.
const familyByCategory: Record<ExerciseCategory, ExerciseFamily> = {
  strength: "strength",
  plyo: "plyometrics",
  jump: "plyometrics",
  running_drill: "running",
  stairs: "stairs",
  cones: "coordination",
  mobility: "mobility",
  warmup: "warmup",
};

export const exerciseFamilyOf = (guideFamily: ExerciseFamily | null | undefined, category: string): ExerciseFamily =>
  guideFamily ?? familyByCategory[category as ExerciseCategory] ?? "strength";

/** Une recherche trouve une fiche par son nom ou l'un de ses autres noms, sans accents ni majuscules. */
export const matchesExerciseSearch = (exercise: { name: string; aliases?: readonly string[] }, search: string) => {
  const term = normalizeExerciseTerm(search);
  if (!term) return true;
  return [exercise.name, ...(exercise.aliases ?? [])].some((name) => normalizeExerciseTerm(name).includes(term));
};

/**
 * L'ordre d'affichage : celui de la liste quand on en regarde une, sinon l'ordre alphabétique. Un nom qui commence
 * par la recherche passe devant un nom qui la contient.
 */
export const sortExercises = <E extends { id: string; name: string; aliases?: readonly string[] }>(
  exercises: readonly E[],
  search: string,
  listOrder?: readonly string[],
): E[] => {
  if (listOrder) {
    const rank = new Map(listOrder.map((id, index) => [id, index]));
    return [...exercises].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
  }
  const term = normalizeExerciseTerm(search);
  const starts = (e: E) =>
    term && [e.name, ...(e.aliases ?? [])].some((name) => normalizeExerciseTerm(name).startsWith(term)) ? 0 : 1;
  return [...exercises].sort((a, b) => starts(a) - starts(b) || a.name.localeCompare(b.name, "fr"));
};

/** Le nouvel ordre après avoir monté ou descendu un élément d'un rang ; inchangé au bord. */
export const moveInOrder = <T>(items: readonly T[], index: number, direction: -1 | 1): T[] => {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
};
