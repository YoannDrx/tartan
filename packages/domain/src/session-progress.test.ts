import { describe, expect, it } from "vitest";
import type { SnapshotItem } from "@tartan/contracts";
import { executionProgress, executionRestSeconds, executionSetProgress, resizeSetProgress } from "./session-progress";

const exercise = (ref: string, sets = 2): SnapshotItem => ({
  ref,
  name: ref,
  exerciseId: null,
  category: "strength",
  cues: [],
  media: null,
  prescription: { sets, reps: 5, rest_s: 30 },
  restAfterLastSetS: 0,
});
const pause: SnapshotItem = { ...exercise("pause"), kind: "recovery", prescription: { duration_s: 60 } };

describe("progression des occurrences exécutées", () => {
  it("conserve les réponses après ajout de séries et ignore les séries supprimées", () => {
    expect(resizeSetProgress([true], 3)).toEqual([true, false, false]);
    expect(resizeSetProgress([false, true, true], 1)).toEqual([false]);
    expect(executionProgress([exercise("a", 3)], { a: [true] }).complete).toBe(false);
    expect(executionProgress([exercise("a", 1)], { a: [true, false] }).complete).toBe(true);
  });
  it("ne coche ni ne journalise une récupération", () => {
    expect(executionSetProgress(pause, { pause: [true] })).toEqual([]);
    expect(executionProgress([pause], { pause: [true] })).toEqual({ complete: false, sets: [] });
    expect(executionRestSeconds(pause, {})).toBe(60);
  });
  it("respecte le repos final explicite et la compatibilité des anciennes séances", () => {
    const item = exercise("a");
    expect(executionRestSeconds(item, { a: [true, false] })).toBe(30);
    expect(executionRestSeconds(item, { a: [true, true] })).toBe(0);
    expect(executionRestSeconds({ ...item, restAfterLastSetS: 15 }, { a: [true, true] })).toBe(15);
    expect(executionRestSeconds({ ...item, restAfterLastSetS: undefined }, { a: [true, true] })).toBe(30);
  });
  it("distingue les occurrences d’un même exercice à chaque tour", () => {
    const items = [
      exercise("a-tour1", 1),
      pause,
      exercise("b-tour1", 1),
      exercise("a-tour2", 1),
      exercise("b-tour2", 1),
    ];
    const progress = { "a-tour1": [true], "b-tour1": [true], "a-tour2": [false], "b-tour2": [true], pause: [true] };
    expect(executionProgress(items, progress).complete).toBe(false);
    expect(executionProgress(items, progress).sets.map((s) => s.itemRef)).toEqual([
      "a-tour1",
      "b-tour1",
      "a-tour2",
      "b-tour2",
    ]);
    expect(executionProgress(items, { ...progress, "a-tour2": [true] }).complete).toBe(true);
  });
  it("ne fabrique pas de saisie pour les exercices jamais ouverts", () => {
    expect(executionProgress([exercise("a"), exercise("b")], { a: [true, false, true], removed: [true] })).toEqual({
      complete: false,
      sets: [
        { itemRef: "a", setIndex: 0, done: true },
        { itemRef: "a", setIndex: 1, done: false },
      ],
    });
  });
});
