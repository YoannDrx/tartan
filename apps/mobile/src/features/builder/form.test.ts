import { expect, it } from "vitest";
import {
  parsePrescriptionFields,
  prescriptionFields,
  prescriptionFieldsSchema,
  parseSessionForm,
  localSchedule,
  scheduleToUtc,
  startSetPlanFields,
} from "./form";

it("conserve les décimales françaises, les zéros permis et la cible distincte de la charge", () => {
  const fields = prescriptionFields({
    sets: 3,
    reps: 4,
    load: { type: "kg", value: 42.5 },
    intensityTarget: { type: "rir", value: 0 },
    rest_s: 0,
    unit: "par côté",
    count: 8,
    height_cm: 40,
    tempo: "3-1-1",
    notes: "Contrôle",
  });
  fields.loadValue = "42,5";
  expect(parsePrescriptionFields(fields)).toMatchObject({
    success: true,
    data: {
      load: { type: "kg", value: 42.5 },
      intensityTarget: { type: "rir", value: 0 },
      rest_s: 0,
      unit: "par côté",
      count: 8,
      height_cm: 40,
    },
  });
});
it.each(["3oops", "1e2", "-2", "1,2,3", "Infinity"])("refuse %s sans troncature", (value) => {
  expect(parsePrescriptionFields({ ...prescriptionFields({}), loadType: "kg", loadValue: value }).success).toBe(false);
});
it("conserve foulées et espacement décimal, y compris à la reprise d’un ancien brouillon", () => {
  const fields = prescriptionFields({ reps: 3, strides: 8, cone_spacing_ft: 4.5 });
  expect(parsePrescriptionFields({ ...fields, cone_spacing_ft: "4,5" })).toMatchObject({
    success: true,
    data: { reps: 3, strides: 8, cone_spacing_ft: 4.5 },
  });
  expect(parsePrescriptionFields({ ...fields, strides: "2,5" }).success).toBe(false);
  expect(parsePrescriptionFields({ ...fields, cone_spacing_ft: "0" }).success).toBe(false);
  const { strides, cone_spacing_ft, ...old } = fields;
  expect(prescriptionFieldsSchema.parse(old)).toMatchObject({ strides: "", cone_spacing_ft: "" });
});
it("ne fabrique ni référence de force ni kilogrammes depuis le RPE", () => {
  expect(
    parsePrescriptionFields({ ...prescriptionFields({}), loadType: "pct_1rm", loadValue: "80", test: "" }).success,
  ).toBe(false);
  const result = parsePrescriptionFields({ ...prescriptionFields({}), intensityType: "rpe", intensityValue: "8" });
  expect(result).toMatchObject({ success: true, data: { intensityTarget: { type: "rpe", value: 8 } } });
  if (result.success) expect(result.data.load).toBeUndefined();
});
it("refuse les répétitions fractionnelles et conserve un champ vide comme absent", () => {
  expect(parsePrescriptionFields({ ...prescriptionFields({}), reps: "3,5" }).success).toBe(false);
  const result = parsePrescriptionFields(prescriptionFields({}));
  if (result.success) expect(result.data.reps).toBeUndefined();
  expect(result.success).toBe(true);
});
it("une durée mal saisie ne devient pas une durée présumée", () => {
  expect(
    parseSessionForm(
      {
        date: "2030-06-12",
        startTime: null,
        location: null,
        publishAt: null,
        assignments: [],
        overrides: [],
        draft: {
          title: "Force",
          type: "strength",
          durationMin: null,
          coachNote: null,
          blocks: [{ name: "Force", variant: "club", items: [] }],
        },
      },
      "45min",
    ).success,
  ).toBe(false);
});

it("la publication locale conserve son instant après aller-retour", () => {
  const iso = "2030-06-12T16:00:00.000Z";
  expect(scheduleToUtc(localSchedule(iso))).toBe(iso);
  expect(scheduleToUtc("2030-02-30T18:00")).toBe("2030-02-30T18:00");
  expect(scheduleToUtc("2030-02-28T28:00")).toBe("2030-02-28T28:00");
});

it("conserve une consigne développée entière pour correction et refuse de l'appliquer trop longue", () => {
  const notes = "Consigne sportive. ".repeat(40);
  const fields = prescriptionFields({ sets: 3, reps: 4, notes });
  expect(fields.notes).toBe(notes);
  expect(parsePrescriptionFields(fields).success).toBe(false);
  fields.notes = "Consigne relue.";
  expect(parsePrescriptionFields(fields)).toMatchObject({
    success: true,
    data: { sets: 3, reps: 4, notes: "Consigne relue." },
  });
});

it("lit et rend un détail série par série, échauffement et pyramide compris", () => {
  const fields = prescriptionFields({
    sets: 3,
    reps: 8,
    load: { type: "kg", value: 40 },
    setPlan: [
      { reps: 8, load: { type: "kg", value: 40 }, warmup: true },
      { reps: 5, load: { type: "kg", value: 60 } },
      { reps: 3, load: { type: "kg", value: 70 } },
    ],
  });
  expect(fields.setPlan).toEqual([
    { reps: "8", load: "40", warmup: true },
    { reps: "5", load: "60", warmup: false },
    { reps: "3", load: "70", warmup: false },
  ]);
  fields.setPlan![2] = { reps: "3", load: "72,5", warmup: false };
  const result = parsePrescriptionFields(fields);
  // Les anciens clients lisent la première série de travail et le nombre de séries.
  expect(result).toMatchObject({
    success: true,
    data: { sets: 3, reps: 5, load: { type: "kg", value: 60 } },
  });
  if (result.success)
    expect(result.data.setPlan).toEqual([
      { reps: 8, load: { type: "kg", value: 40 }, warmup: true },
      { reps: 5, load: { type: "kg", value: 60 } },
      { reps: 3, load: { type: "kg", value: 72.5 } },
    ]);
});

it("pose le test de référence sur chaque série en pourcentage et refuse une série mal saisie", () => {
  const fields = {
    ...prescriptionFields({}),
    loadType: "pct_1rm" as const,
    test: "back_squat",
    setPlan: [
      { reps: "5", load: "70", warmup: false },
      { reps: "3", load: "80", warmup: false },
    ],
  };
  const result = parsePrescriptionFields(fields);
  if (result.success)
    expect(result.data.setPlan?.[1]).toEqual({ reps: 3, load: { type: "pct_1rm", value: 80, test: "back_squat" } });
  expect(result.success).toBe(true);
  expect(parsePrescriptionFields({ ...fields, setPlan: [{ reps: "4,5", load: "70", warmup: false }] }).success).toBe(
    false,
  );
});

it("démarre un détail depuis la saisie uniforme en cours", () => {
  expect(
    startSetPlanFields({ ...prescriptionFields({}), sets: "2", reps: "6", loadType: "kg", loadValue: "50" }),
  ).toEqual([
    { reps: "6", load: "50", warmup: false },
    { reps: "6", load: "50", warmup: false },
  ]);
});
