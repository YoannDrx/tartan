import { describe, expect, it } from "vitest";
import { exerciseInput } from "@tartan/contracts";
import { STARTER_LIBRARY } from "./starter-library";

const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

describe("bibliothèque initiale de préparation physique", () => {
  it("offre au moins quarante références distinctes dans les cinq usages", () => {
    expect(STARTER_LIBRARY.length).toBeGreaterThanOrEqual(40);
    expect(new Set(STARTER_LIBRARY.map((exercise) => normalized(exercise.name))).size).toBe(STARTER_LIBRARY.length);
    for (const usage of ["Force", "Vitesse", "Puissance", "Endurance", "Mobilité"])
      expect(STARTER_LIBRARY.filter((exercise) => exercise.tags.includes(usage)).length).toBeGreaterThanOrEqual(4);
    // Ces deux paires désignaient le même mouvement ; une variante orthographique n'est pas une référence.
    expect(STARTER_LIBRARY.filter((exercise) => ["Gainage", "Gainage ventral"].includes(exercise.name))).toHaveLength(
      1,
    );
    expect(
      STARTER_LIBRARY.filter((exercise) => ["Bonds alternés", "Foulées bondissantes"].includes(exercise.name)),
    ).toHaveLength(1);
  });

  it("respecte le contrat de l’éditeur et ne fournit aucun média tiers implicite", () => {
    for (const exercise of STARTER_LIBRARY) {
      const input = exerciseInput.parse({ ...exercise, defaultPrescription: exercise.prescription });
      expect(input.classification?.movement).toBeTruthy();
      expect(input.classification?.equipment).not.toBeNull();
      expect(input.cues.length).toBeGreaterThan(0);
      expect(input.media).toBeUndefined();
      if (input.defaultPrescription.load) expect(input.strengthLoadKind).toBe("external_total");
      if (input.tags.includes("Poids du corps")) {
        expect(input.strengthLoadKind).toBe("bodyweight");
        expect(input.defaultPrescription.load).toBeUndefined();
      }
    }
  });
});
