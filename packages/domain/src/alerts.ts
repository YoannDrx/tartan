import type { CellStatus } from "@tartan/contracts";
import { trailingMissedCount } from "./status";

export const MISSED_STREAK_THRESHOLD = 2;
export const ABNORMAL_RPE_THRESHOLD = 9;

export type AlertInput = {
  recentStatuses: CellStatus[];
  lastRpe: number | null;
  lastPain: { recent: boolean } | null;
  activeInjury: boolean;
};

export type AlertKind = "pain" | "missed_streak" | "abnormal_rpe" | "active_injury";

export const alertKinds = (input: AlertInput): AlertKind[] => {
  const kinds: AlertKind[] = [];
  if (input.lastPain?.recent) kinds.push("pain");
  if (trailingMissedCount(input.recentStatuses) >= MISSED_STREAK_THRESHOLD) kinds.push("missed_streak");
  if (input.lastRpe !== null && input.lastRpe >= ABNORMAL_RPE_THRESHOLD) kinds.push("abnormal_rpe");
  if (input.activeInjury) kinds.push("active_injury");
  return kinds;
};

// Tri de la grille : douleur, puis blessure active, puis ordre alphabétique.
export const trackingPriority = (row: {
  hasPain: boolean;
  activeInjury: string | null;
  name: string;
}): [number, string] => [row.hasPain ? 0 : row.activeInjury ? 1 : 2, row.name];

export const compareTrackingRows = (
  a: Parameters<typeof trackingPriority>[0],
  b: Parameters<typeof trackingPriority>[0],
): number => {
  const [pa, na] = trackingPriority(a);
  const [pb, nb] = trackingPriority(b);
  return pa - pb || na.localeCompare(nb, "fr");
};
