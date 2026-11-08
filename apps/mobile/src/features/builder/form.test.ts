import { expect, it } from "vitest";
import { parsePrescriptionFields, prescriptionFields, parseSessionForm, localSchedule, scheduleToUtc } from "./form";

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
