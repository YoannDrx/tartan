import type { Prescription } from "@tartan/contracts";
import { plannedSetLoadKg } from "./set-plan";

// Charge de séance (session-RPE) : effort ressenti × durée. Aide à la décision, pas un diagnostic (§ 7.9).
export const sessionLoad = (rpe: number | null, durationMin: number | null): number | null =>
  rpe !== null && durationMin !== null ? rpe * durationMin : null;

export type WeekVolumes = { groundContacts: number; tonnageKg: number; distanceM: number; jumps: number };

export const emptyVolumes = (): WeekVolumes => ({ groundContacts: 0, tonnageKg: 0, distanceM: 0, jumps: 0 });

export const addPrescriptionVolumes = (
  into: WeekVolumes,
  p: Prescription,
  resolvedLoadKg: number | null,
): WeekVolumes => {
  const sets = p.setPlan?.length ?? p.sets ?? 1;
  // Série par série, chaque série compte ses propres répétitions et sa propre charge.
  const tonnage = p.setPlan?.length
    ? p.setPlan.reduce((total, set) => total + (set.reps ?? 0) * (plannedSetLoadKg(set, p, resolvedLoadKg) ?? 0), 0)
    : resolvedLoadKg !== null && p.reps
      ? sets * p.reps * resolvedLoadKg
      : 0;
  return {
    groundContacts: into.groundContacts + (p.ground_contacts ?? 0),
    tonnageKg: into.tonnageKg + tonnage,
    distanceM: into.distanceM + (p.distance_m ? sets * p.distance_m : 0),
    jumps: into.jumps,
  };
};

// Compare la dernière semaine à la moyenne des semaines précédentes, sans jamais conclure à un risque.
export const weekTrendPct = (weeks: (number | null)[]): number | null => {
  const current = weeks.at(-1);
  const previous = weeks.slice(0, -1).filter((w): w is number => w !== null);
  if (current == null || previous.length === 0) return null;
  const mean = previous.reduce((a, b) => a + b, 0) / previous.length;
  return mean === 0 ? null : Math.round(((current - mean) / mean) * 100);
};

const csvCell = (value: string | number | null): string => {
  const text = value === null ? "" : String(value);
  // Une cellule qui commence par = + - @ serait exécutée comme formule par un tableur.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[";\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export const toCsv = (header: string[], rows: (string | number | null)[][]): string =>
  [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
