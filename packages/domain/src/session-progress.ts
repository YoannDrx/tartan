import type { SnapshotItem } from "@tartan/contracts";
import { countSets } from "./charges";

type ExecutionItem = Pick<SnapshotItem, "ref" | "kind" | "prescription" | "restAfterLastSetS">;
export type SessionSetProgress = Readonly<Record<string, readonly boolean[]>>;

// Ignore stale series after an edit and leave newly added series unchecked.
export const resizeSetProgress = (stored: readonly boolean[] | undefined, total: number): boolean[] =>
  Array.from({ length: total }, (_, index) => stored?.[index] === true);

export const executionSetProgress = (item: ExecutionItem, progress: SessionSetProgress): boolean[] =>
  resizeSetProgress(progress[item.ref], item.kind === "recovery" ? 0 : countSets(item));

export const executionRestSeconds = (item: ExecutionItem, progress: SessionSetProgress): number | undefined => {
  if (item.kind === "recovery") return item.prescription.duration_s;
  const sets = executionSetProgress(item, progress);
  return sets.every(Boolean) ? (item.restAfterLastSetS ?? item.prescription.rest_s) : item.prescription.rest_s;
};

export const executionProgress = (items: readonly ExecutionItem[], progress: SessionSetProgress) => {
  const exercises = items.filter((item) => item.kind !== "recovery");
  return {
    complete: exercises.length > 0 && exercises.every((item) => executionSetProgress(item, progress).every(Boolean)),
    // Only log series with a local answer; do not invent answers for untouched exercises.
    sets: exercises.flatMap((item) =>
      (progress[item.ref] ?? []).slice(0, countSets(item)).map((done, setIndex) => ({
        itemRef: item.ref,
        setIndex,
        done,
      })),
    ),
  };
};

// Les occurrences d’un même mouvement dans les tours d’un circuit partagent sourceRef.
export function exerciseTransition(
  items: readonly (ExecutionItem & { sourceRef?: string | null })[],
  current: ExecutionItem & { sourceRef?: string | null },
  done: (ref: string, index: number) => boolean,
): "last" | "exercise" | null {
  let remaining = 0;
  const source = current.sourceRef ?? current.ref;
  for (const item of items) {
    if (item.kind === "recovery" || (item.sourceRef ?? item.ref) !== source) continue;
    for (let set = 0; set < countSets(item); set++) if (!done(item.ref, set)) remaining++;
  }
  return remaining === 0 ? "exercise" : remaining === 1 ? "last" : null;
}
