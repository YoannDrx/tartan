import { expect, it } from "vitest";
import { plannerEquipmentAvailable, plannerRequiredEquipment } from "./planner-equipment";

it("résout le vocabulaire français et anglais sans confondre les appareils", () => {
  expect(
    plannerEquipmentAvailable({ movement: "squat", equipment: ["barbell", "rack"] }, [
      "Barre olympique",
      "rack à squat",
    ]),
  ).toBe(true);
  expect(plannerEquipmentAvailable({ movement: "pull", equipment: ["pullup_bar"] }, ["barre"])).toBe(false);
  expect(plannerEquipmentAvailable({ movement: "jump", equipment: ["boxes"] }, ["box"])).toBe(true);
  expect(plannerEquipmentAvailable({ movement: "run", equipment: ["steps"] }, ["stairs"])).toBe(true);
});
it("ne transforme ni une classification inconnue ni un appareil manquant en poids du corps", () => {
  expect(plannerEquipmentAvailable(null, [])).toBe(false);
  expect(plannerEquipmentAvailable({ movement: null, equipment: null }, [])).toBe(false);
  expect(plannerEquipmentAvailable({ movement: null, equipment: ["other"] }, ["other"])).toBe(false);
  expect(plannerEquipmentAvailable({ movement: "squat", equipment: [] }, [])).toBe(true);
  expect(plannerEquipmentAvailable({ movement: "push", equipment: ["dumbbells", "bench"] }, ["haltères"])).toBe(false);
});

it("reconnaît la corde uniquement pour les fiches qui l’utilisent", () => {
  for (const key of ["easy-jump-rope", "rope-boxer-step", "rope-skier", "rope-running-step"]) {
    const e = { equipment: plannerRequiredEquipment(key, ["other"]) };
    expect(plannerEquipmentAvailable(e, ["corde à sauter", "kettlebell"])).toBe(true);
    expect(plannerEquipmentAvailable(e, ["kettlebell"])).toBe(false);
  }
  expect(plannerEquipmentAvailable({ equipment: plannerRequiredEquipment("inconnu", ["other"]) }, ["corde"])).toBe(
    false,
  );
});
