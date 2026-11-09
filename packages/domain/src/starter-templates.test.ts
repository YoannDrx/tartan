import { prescriptionSchema } from "@tartan/contracts";
import { describe, expect, it } from "vitest";
import { STARTER_LIBRARY } from "./starter-library";
import { STARTER_TEMPLATES } from "./starter-templates";

describe("séances de départ", () => {
  it("ne citent que des exercices de la bibliothèque initiale", () => {
    const names = new Set(STARTER_LIBRARY.map((exercise) => exercise.name));
    for (const template of STARTER_TEMPLATES) {
      for (const block of template.blocks) {
        for (const item of block.items) expect(names.has(item.exercise), item.exercise).toBe(true);
      }
    }
  });

  it("portent des prescriptions valides", () => {
    for (const item of STARTER_TEMPLATES.flatMap((template) => template.blocks.flatMap((block) => block.items))) {
      expect(prescriptionSchema.safeParse(item.prescription).success).toBe(true);
    }
  });

  it("couvrent musculation, pliométrie, technique de course et plots", () => {
    expect(STARTER_TEMPLATES.map((template) => template.type).sort()).toEqual(["cones", "plyo", "running", "strength"]);
  });

  it("offrent assez d'exercices de plots et d'escaliers", () => {
    expect(STARTER_LIBRARY.filter((exercise) => exercise.category === "cones").length).toBeGreaterThanOrEqual(5);
    expect(STARTER_LIBRARY.filter((exercise) => exercise.category === "stairs").length).toBeGreaterThanOrEqual(4);
  });
});
