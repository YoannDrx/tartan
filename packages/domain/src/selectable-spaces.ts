import type { SpaceSummary } from "@tartan/contracts";

export function selectableSpaces(spaces: SpaceSummary[]) {
  const clubs = spaces.filter((space) => !space.isDemo && space.kind !== "personal");
  return clubs.some((club) => club.role === "athlete") ? clubs : spaces.filter((space) => !space.isDemo);
}
