import type { SessionType } from "@tartan/contracts";

// Les teintes suivent le thème choisi : elles sont définies dans globals.css.
export const activityColors = (type: SessionType) => ({
  background: `var(--activity-${type}-bg)`,
  text: `var(--activity-${type}-text)`,
});
