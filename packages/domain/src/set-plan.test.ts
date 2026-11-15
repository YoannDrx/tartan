import { expect, it } from "vitest";
import type { Prescription } from "@tartan/contracts";
import { countSets, formatPrescription } from "./charges";
import { draftFromSession } from "./performed-sets";
import {
  formatSetPlan,
  plannedSetLoadKg,
  prescribedSetCount,
  setPlanLoadUnit,
  startSetPlan,
  withSetPlan,
  withoutSetPlan,
} from "./set-plan";
import { prescriptionForGroup } from "./session-sequence-edit";
import { addPrescriptionVolumes, emptyVolumes } from "./training-load";

const pyramid: Prescription = withSetPlan({ rest_s: 120 }, [
  { reps: 8, load: { type: "kg", value: 40 }, warmup: true },
  { reps: 5, load: { type: "kg", value: 60 }, warmup: true },
  { reps: 5, load: { type: "kg", value: 70 } },
  { reps: 5, load: { type: "kg", value: 70 } },
  { reps: 3, load: { type: "kg", value: 80 } },
]);

it("garde séries, répétitions et charge alignés sur le détail pour les anciens clients", () => {
  expect(pyramid.sets).toBe(5);
  expect(pyramid.reps).toBe(5);
  expect(pyramid.load).toEqual({ type: "kg", value: 70 });
  expect(prescribedSetCount(pyramid)).toBe(5);
  expect(countSets({ prescription: { ...pyramid, sets: 2 } })).toBe(5);
  expect(withoutSetPlan(pyramid)).toEqual({ rest_s: 120, sets: 5, reps: 5, load: { type: "kg", value: 70 } });
});

it("écrit la pyramide en clair, échauffement à part et séries identiques regroupées", () => {
  expect(formatSetPlan(pyramid)).toBe(
    "Échauffement 8 rép. à 40 kg, 5 rép. à 60 kg · 2 × 5 rép. à 70 kg, 3 rép. à 80 kg",
  );
  expect(formatPrescription(pyramid)).toBe(
    "Échauffement 8 rép. à 40 kg, 5 rép. à 60 kg · 2 × 5 rép. à 70 kg, 3 rép. à 80 kg · récup 2 min",
  );
});

it("calcule les pourcentages sur la référence figée, sinon en proportion, et ne devine rien d'autre", () => {
  const pct = withSetPlan({}, [
    { reps: 5, load: { type: "pct_1rm", value: 70, test: "back_squat" } },
    { reps: 3, load: { type: "pct_1rm", value: 80, test: "back_squat" } },
  ]);
  const set = pct.setPlan![1]!;
  expect(plannedSetLoadKg(set, pct, null, { value: 100, kind: "one_rm", exerciseKey: "back_squat" })).toBe(80);
  expect(plannedSetLoadKg(set, pct, null, { value: 100, kind: "one_rm", exerciseKey: "deadlift" })).toBeNull();
  expect(plannedSetLoadKg(set, pct, 70)).toBe(80);
  expect(plannedSetLoadKg(set, pct, null)).toBeNull();
  expect(formatSetPlan(pct)).toBe("5 rép. à 70 % du max, 3 rép. à 80 % du max");
  expect(plannedSetLoadKg({ reps: 10 }, pct, 70)).toBeNull();
});

it("compte le volume série par série", () => {
  expect(addPrescriptionVolumes(emptyVolumes(), pyramid, 70).tonnageKg).toBe(8 * 40 + 5 * 60 + 2 * 5 * 70 + 3 * 80);
});

it("part d'une prescription uniforme et change d'unité sans perdre les nombres", () => {
  const start = startSetPlan({ sets: 3, reps: 5, load: { type: "kg", value: 60 } });
  expect(start).toHaveLength(3);
  expect(start[0]).toEqual({ reps: 5, load: { type: "kg", value: 60 } });
  const pct = setPlanLoadUnit(start, { type: "pct_1rm", value: 75, test: "back_squat" });
  expect(pct[0]!.load).toEqual({ type: "pct_1rm", value: 60, test: "back_squat" });
  expect(setPlanLoadUnit(start, undefined)[0]).toEqual({ reps: 5 });
});

it("propose chaque série détaillée à la saisie, échauffement compris", () => {
  const draft = draftFromSession({
    sessionVersion: 1,
    variant: "club",
    log: null,
    blocks: [
      {
        ref: "b",
        name: "Force",
        variant: "club",
        items: [
          {
            ref: "squat",
            name: "Squat",
            category: "strength",
            cues: [],
            media: null,
            prescription: pyramid,
            resolvedLoadKg: 70,
            setLoadsKg: [40, 60, 70, 70, 80],
            summary: "",
          },
        ],
      },
    ],
  } as unknown as Parameters<typeof draftFromSession>[0]);
  expect(draft.rows).toHaveLength(5);
  expect(draft.rows.map((row) => [row.setKind, row.reps, row.loadKg])).toEqual([
    ["warmup", "8", "40"],
    ["warmup", "5", "60"],
    ["work", "5", "70"],
    ["work", "5", "70"],
    ["work", "3", "80"],
  ]);
});

it("un exercice détaillé qui entre dans un groupe passe à une série par tour, sans détail", () => {
  expect(prescriptionForGroup(pyramid)).toEqual({ sets: 1, reps: 5, load: { type: "kg", value: 70 } });
});
