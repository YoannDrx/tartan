import { m } from "@tartan/i18n";
import { describe, expect, it } from "vitest";
import { buildExerciseInput, type ExerciseDraft } from "./exercise-form";

const draft = (over: Partial<ExerciseDraft> = {}): ExerciseDraft => ({
  name: "Fentes sautées",
  category: "plyo",
  cues: "Buste droit\n\n  Pose active ",
  tags: ["bas du corps"],
  base: { load: { type: "kg", value: 20 }, notes: "Sur herbe" },
  numbers: { sets: "3", reps: "10", distance_m: "", duration_s: "", rest_s: "90", ground_contacts: "" },
  url: "",
  title: "",
  startS: "",
  endS: "",
  ...over,
});

describe("formulaire d'exercice", () => {
  it("garde les champs absents du formulaire et nettoie les consignes", () => {
    const result = buildExerciseInput(draft({ id: "3f2c1d7e-0000-4000-8000-000000000000" }));
    expect(result).toMatchObject({
      ok: true,
      input: {
        id: "3f2c1d7e-0000-4000-8000-000000000000",
        cues: ["Buste droit", "Pose active"],
        tags: ["bas du corps"],
        media: null,
        defaultPrescription: { sets: 3, reps: 10, rest_s: 90, notes: "Sur herbe", load: { type: "kg", value: 20 } },
      },
    });
  });

  it("retire un nombre vidé", () => {
    const result = buildExerciseInput(
      draft({
        base: { sets: 4, reps: 8 },
        numbers: { sets: "", reps: "8", distance_m: "", duration_s: "", rest_s: "", ground_contacts: "" },
      }),
    );
    expect(result.ok && result.input.defaultPrescription).toEqual({ reps: 8 });
  });

  it("refuse ce que le serveur refuserait", () => {
    expect(buildExerciseInput(draft({ name: "  " }))).toMatchObject({ ok: false, field: "name" });
    expect(buildExerciseInput(draft({ cues: "a\nb\nc\nd\ne\nf" }))).toMatchObject({
      ok: false,
      message: m.mobile.exerciseForm.tooManyCues,
    });
    expect(buildExerciseInput(draft({ url: "https://exemple.fr" }))).toMatchObject({ ok: false, field: "url" });
    expect(buildExerciseInput(draft({ url: "https://youtu.be/dQw4w9WgXcQ", startS: "30", endS: "10" }))).toMatchObject({
      ok: false,
      field: "clip",
    });
    expect(
      buildExerciseInput(
        draft({ numbers: { sets: "0", reps: "", distance_m: "", duration_s: "", rest_s: "", ground_contacts: "" } }),
      ),
    ).toMatchObject({ ok: false, field: "form" });
  });

  it("garde le lien Instagram quand on change seulement le nom", () => {
    const result = buildExerciseInput(
      draft({ name: "Nouveau nom", url: "https://www.instagram.com/reel/DeGC80pC82E/", title: "Hanche" }),
    );
    expect(result).toMatchObject({
      ok: true,
      input: {
        name: "Nouveau nom",
        media: { kind: "instagram", url: "https://www.instagram.com/reel/DeGC80pC82E/", customTitle: "Hanche" },
      },
    });
  });

  it("envoie la vidéo YouTube", () => {
    const result = buildExerciseInput(
      draft({ url: "https://youtu.be/dQw4w9WgXcQ", title: "Démo", startS: "5", endS: "20" }),
    );
    expect(result.ok && result.input.media).toEqual({
      kind: "youtube",
      url: "https://youtu.be/dQw4w9WgXcQ",
      customTitle: "Démo",
      startS: 5,
      endS: 20,
    });
  });
});

it("préserve les conventions et accepte un pas français sans tronquer les nombres", () => {
  expect(buildExerciseInput(draft({ strengthLoadKind: "added_weight", loadStepKg: "2,5" }))).toMatchObject({
    ok: true,
    input: { strengthLoadKind: "added_weight", loadStepKg: 2.5 },
  });
  for (const step of ["", "1kg", "1e2", "0", "101", "1.234"])
    expect(buildExerciseInput(draft({ loadStepKg: step })).ok).toBe(false);
});

it("conserve le classement explicite et distingue absence de matériel et information manquante", () => {
  for (const equipment of [null, [], ["barbell", "rack"]] as const) {
    const classification = { movement: "squat" as const, equipment: equipment === null ? null : [...equipment] };
    expect(buildExerciseInput(draft({ classification }))).toMatchObject({ ok: true, input: { classification } });
  }
});
