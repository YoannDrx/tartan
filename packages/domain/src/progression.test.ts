import { describe, expect, it } from "vitest";
import { detailedSetInput, prescriptionSchema, sessionLogInput, type DetailedSetInput } from "@tartan/contracts";
import { actualSetVolumes, estimateOneRm, percentageTable } from "./progression";

const set = (extra: Partial<DetailedSetInput> = {}): DetailedSetInput => ({
  itemRef: "exercise-one",
  setIndex: 0,
  done: true,
  reps: 4,
  loadKg: 40,
  setKind: "work",
  loadKind: "external",
  repetitionScope: "total",
  sideCount: 1,
  ...extra,
});

describe("réalisé sans substitution de la prescription", () => {
  it("additionne les séries réellement renseignées, y compris une séance partielle", () => {
    expect(actualSetVolumes([set(), set(), set()]).tonnageKg).toBe(480);
    expect(actualSetVolumes([set(), set(), set({ done: false })]).tonnageKg).toBe(320);
    expect(actualSetVolumes([]).tonnageKg).toBeNull();
    expect(actualSetVolumes([set({ loadKg: null })]).tonnageKg).toBeNull();
  });
  it("distingue zéro, données manquantes, échauffement, poids du corps et assistance", () => {
    const actual = actualSetVolumes([
      set({ loadKg: 0 }),
      set({ loadKg: null }),
      set({ setKind: "warmup" }),
      set({ loadKind: "bodyweight" }),
      set({ loadKind: "assisted" }),
    ]);
    expect(actual).toMatchObject({ tonnageKg: 0, completedWorkSets: 4, tonnageKnownSets: 1 });
  });
  it("ne double les répétitions que si les deux côtés sont explicitement réalisés", () => {
    expect(actualSetVolumes([set({ repetitionScope: "per_side", sideCount: 2 })]).tonnageKg).toBe(320);
    expect(actualSetVolumes([set({ repetitionScope: "per_side", sideCount: 1 })]).tonnageKg).toBe(160);
    expect(detailedSetInput.safeParse(set({ sideCount: 2 })).success).toBe(false);
  });
  it("garde distance, durée et contacts dans leurs unités propres", () => {
    expect(actualSetVolumes([set({ distanceM: 100, timeS: 12, groundContacts: 20 })])).toMatchObject({
      distanceM: 100,
      durationS: 12,
      groundContacts: 20,
      tonnageKg: 160,
    });
  });
});

describe("référence de force explicite", () => {
  it("conserve la mesure à une répétition et estime seulement de 2 à 10", () => {
    expect(estimateOneRm(100, 1)).toBe(100);
    expect(estimateOneRm(100, 3)).toBeCloseTo(110);
    expect(estimateOneRm(60, 10)).toBe(80);
    for (const reps of [0, 1.5, 11, NaN]) expect(estimateOneRm(60, reps)).toBeNull();
    expect(estimateOneRm(Infinity, 5)).toBeNull();
    expect(estimateOneRm(-10, 5)).toBeNull();
  });
  it("produit les 13 pourcentages exacts et arrondis sans zone imposée", () => {
    const rows = percentageTable(87);
    expect(rows).toHaveLength(13);
    expect(rows[0]).toEqual({ percent: 40, exactKg: 34.8, roundedKg: 35 });
    expect(rows[12]).toEqual({ percent: 100, exactKg: 87, roundedKg: 87.5 });
    expect(percentageTable(87, 2.5)[0]?.roundedKg).toBe(35);
    expect(() => percentageTable(80, 0)).toThrow(RangeError);
  });
  it("accepte simultanément kilos et cible RPE sans conversion implicite", () => {
    expect(
      prescriptionSchema.parse({ load: { type: "kg", value: 40 }, intensityTarget: { type: "rpe", value: 7 } }),
    ).toMatchObject({ load: { value: 40 }, intensityTarget: { value: 7 } });
  });
  it("exige les versions pour les détails et refuse deux fois la même série", () => {
    const input = { clientId: "mutation-1", status: "done", variantDone: "club", detailedSets: [set()] };
    expect(sessionLogInput.safeParse(input).success).toBe(false);
    expect(sessionLogInput.safeParse({ ...input, expectedVersion: 0, expectedSessionVersion: 1 }).success).toBe(true);
    expect(
      sessionLogInput.safeParse({
        ...input,
        expectedVersion: 0,
        expectedSessionVersion: 1,
        detailedSets: [set(), set()],
      }).success,
    ).toBe(false);
  });
});
