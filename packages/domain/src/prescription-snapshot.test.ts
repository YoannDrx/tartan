import { describe, expect, it } from "vitest";
import type { SessionSnapshot } from "@tartan/contracts";
import { freezePrescription } from "./prescription-snapshot";

const snapshot: SessionSnapshot = {
  title: "Force",
  type: "strength",
  durationMin: 30,
  coachNote: null,
  blocks: [
    {
      ref: "b0",
      name: "Travail",
      variant: "club",
      items: [
        {
          ref: "b0-i0",
          exerciseId: "exercise-one",
          name: "Squat",
          category: "strength",
          cues: [],
          media: null,
          prescription: { sets: 3, reps: 4, load: { type: "pct_1rm", value: 80, test: "squat" } },
        },
      ],
    },
  ],
};
const reference = {
  id: "reference-one",
  exerciseKey: "squat",
  value: 100,
  kind: "one_rm" as const,
  date: "2026-01-01",
  stepKg: 1.25,
};
const firstItem = (s: SessionSnapshot) => s.blocks[0]!.items[0]!;

describe("prescription figée", () => {
  it("conserve la source, applique l'adaptation et ne modifie pas le document d'origine", () => {
    const before = structuredClone(snapshot);
    const frozen = freezePrescription(snapshot, [reference], [{ itemRef: "b0-i0", prescription: { reps: 6 } }]);
    expect(firstItem(frozen)).toMatchObject({
      resolvedLoadKg: 80,
      prescription: { reps: 6 },
      strengthReference: reference,
    });
    expect(snapshot).toEqual(before);
  });
  it("ne remplace pas une donnée manquante par un maximum ajouté plus tard", () => {
    const first = freezePrescription(snapshot, [], []);
    expect(firstItem(freezePrescription(snapshot, [reference], [], first)).resolvedLoadKg).toBeNull();
  });
  it("un nouvel item reçoit la référence actuelle, l'item déplacé garde la sienne", () => {
    const frozen = freezePrescription(snapshot, [reference], []);
    const revised = structuredClone(snapshot);
    revised.blocks[0]!.items.unshift({ ...firstItem(snapshot), ref: "new-item" });
    const result = freezePrescription(revised, [{ ...reference, value: 200 }], [], frozen);
    expect(result.blocks[0]!.items.map((i) => i.resolvedLoadKg)).toEqual([160, 80]);
  });
  it("conserve une charge absolue et ne calcule pas de kilos depuis une intensité RPE", () => {
    const kg = freezePrescription(
      snapshot,
      [],
      [
        {
          itemRef: "b0-i0",
          prescription: { load: { type: "kg", value: 45 }, intensityTarget: { type: "rpe", value: 8 } },
        },
      ],
    );
    expect(firstItem(kg).resolvedLoadKg).toBe(45);
    const rpeOnly = structuredClone(snapshot);
    firstItem(rpeOnly).prescription = { sets: 3, reps: 4, intensityTarget: { type: "rpe", value: 8 } };
    expect(firstItem(freezePrescription(rpeOnly, [reference], [])).resolvedLoadKg).toBeNull();
  });
});
