import type { ExerciseClassification } from "@tartan/contracts";

const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[_’-]/g, " ").trim().replace(/\s+/g, " ");
// Exact vocabulary only: a nearby word must not authorize a different apparatus.
const aliases: Record<string, string[]> = {
  barbell: ["barre", "barre olympique"],
  dumbbells: ["dumbbell", "haltere", "halteres"],
  kettlebells: ["kettlebell"],
  jump_rope: ["corde", "corde à sauter", "jump rope", "skipping rope"],
  sliders: ["patin", "patins", "patins glissants", "disques glissants", "sliding discs"],
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

// La classification des anciens clients range ces accessoires dans « autre ».
const specificEquipment: ReadonlyMap<string, string> = new Map([
  ["easy-jump-rope", "jump_rope"],
  ["rope-boxer-step", "jump_rope"],
  ["rope-skier", "jump_rope"],
  ["rope-running-step", "jump_rope"],
  ["hamstring-slider", "sliders"],
]);
export const plannerCatalogEquipment = (key?: string | null) => (key ? specificEquipment.get(key) : undefined);
export function plannerRequiredEquipment(
  key: string | null | undefined,
  equipment: NonNullable<ExerciseClassification["equipment"]> | null | undefined,
) {
  if (!equipment) return null;
  return equipment.map((e) => (e === "other" ? (plannerCatalogEquipment(key) ?? e) : e));
}

/** Unknown classification is not evidence that an exercise requires no equipment. */
export function plannerEquipmentAvailable(
  classification: { movement?: string | null; equipment?: readonly string[] | null } | null | undefined,
  available: readonly string[],
) {
  if (!classification?.equipment || classification.equipment.includes("other")) return false;
  const keys = new Set(available.map((value) => equipmentKeys.get(normalize(value))).filter(Boolean));
  return classification.equipment.every((key) => keys.has(key));
}
