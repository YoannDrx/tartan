import type { ExerciseClassification } from "@tartan/contracts";

const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[_’-]/g, " ").trim().replace(/\s+/g, " ");
// Exact vocabulary only: a nearby word must not authorize a different apparatus.
const aliases: Record<string, string[]> = {
  barbell: ["barre", "barre olympique"],
  dumbbells: ["dumbbell", "haltere", "halteres"],
  kettlebells: ["kettlebell"],
  bands: ["band", "elastique", "elastiques", "bandes elastiques"],
  medicine_ball: ["medicine ball", "medecine ball", "medecine balls"],
  boxes: ["box", "caisson", "caissons"],
  hurdles: ["hurdle", "haie", "haies"],
  cones: ["cone", "plot", "plots"],
  track: ["piste"],
  hill: ["cote", "cotes", "pente"],
  steps: ["stairs", "escalier", "escaliers"],
  bench: ["banc", "banc de musculation"],
  rack: ["rack a squat", "cage a squat"],
  machines: ["machine"],
  timing: ["chronometre", "cellules de chronometrage"],
  pullup_bar: ["barre de traction", "barre de tractions"],
  jump_mat: ["tapis de saut"],
  stick: ["baton", "baton pvc"],
};
const equipmentKeys = new Map(
  Object.entries(aliases).flatMap(([key, names]) => [key, ...names].map((name) => [normalize(name), key] as const)),
);

/** Unknown classification is not evidence that an exercise requires no equipment. */
export function plannerEquipmentAvailable(
  classification: ExerciseClassification | null | undefined,
  available: readonly string[],
) {
  if (!classification?.equipment || classification.equipment.includes("other")) return false;
  const keys = new Set(available.map((value) => equipmentKeys.get(normalize(value))).filter(Boolean));
  return classification.equipment.every((key) => keys.has(key));
}
