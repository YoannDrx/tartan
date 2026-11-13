import { expect, it } from "vitest";
import { plannerEquipmentAvailable } from "./planner-equipment";

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
