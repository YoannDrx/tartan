import { normalizeExerciseTerm } from "./exercise-aliases";

type Candidate = { id: string; name: string; aliases?: readonly string[] };
const words = (text: string) =>
  normalizeExerciseTerm(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2);

/** Retrieval only: a similar name is a candidate, never an automatic substitution. */
export function rankPlannerCandidates<T extends Candidate>(exercises: readonly T[], text: string, limit = 150): T[] {
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
