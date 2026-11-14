import type { SessionType } from "@tartan/contracts";

// Les teintes suivent le thème choisi : elles sont définies dans globals.css.
export const activityColors = (type: SessionType) => ({
  background: `var(--activity-${type}-bg)`,
  text: `var(--activity-${type}-text)`,
});

// Une famille d'exercice prend la teinte de son activité : liseré, pictogramme et libellé l'accompagnent toujours.
const CATEGORY_TONE: Record<string, SessionType> = {
  strength: "strength",
  plyo: "plyo",
  running_drill: "running",
  stairs: "stairs",
  cones: "cones",
  mobility: "mobility",
  jump: "jump",
  warmup: "mobility",
};
export const categoryColors = (category: string | undefined) => activityColors(CATEGORY_TONE[category ?? ""] ?? "strength");
