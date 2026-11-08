import type { DetailedSetInput } from "@tartan/contracts";
import { PLATE_STEP_KG, roundToPlate } from "./charges";

// Une répétition est une mesure ; Epley n'est utilisé que dans la plage décidée 2–10.
export const estimateOneRm = (loadKg: number, reps: number): number | null => {
  if (!Number.isFinite(loadKg) || loadKg <= 0 || !Number.isInteger(reps) || reps < 1 || reps > 10) return null;
  return reps === 1 ? loadKg : loadKg * (1 + reps / 30);
};

export const percentageTable = (referenceKg: number, stepKg = PLATE_STEP_KG) => {
  if (!Number.isFinite(referenceKg) || referenceKg <= 0 || !Number.isFinite(stepKg) || stepKg <= 0)
    throw new RangeError("La référence et le pas doivent être strictement positifs et finis.");
  return Array.from({ length: 13 }, (_, i) => {
    const percent = 40 + 5 * i;
    const exactKg = (referenceKg * percent) / 100;
    return { percent, exactKg, roundedKg: roundToPlate(exactKg, stepKg) };
  });
};

export type ActualVolumes = {
  tonnageKg: number | null;
  distanceM: number | null;
  durationS: number | null;
  groundContacts: number | null;
  completedWorkSets: number;
  tonnageKnownSets: number;
};

// Unité et provenance explicites : pas de poids de corps supposé, ni de forfait pour une séance partielle.
export const actualSetVolumes = (sets: readonly DetailedSetInput[]): ActualVolumes => {
  const result: ActualVolumes = {
    tonnageKg: null,
    distanceM: null,
    durationS: null,
    groundContacts: null,
    completedWorkSets: 0,
    tonnageKnownSets: 0,
  };
  for (const set of sets) {
    if (!set.done || set.setKind !== "work") continue;
    result.completedWorkSets++;
    if (set.loadKind === "external" && set.loadKg != null && set.reps != null) {
      const reps = set.reps * (set.repetitionScope === "per_side" ? set.sideCount : 1);
      result.tonnageKg = (result.tonnageKg ?? 0) + set.loadKg * reps;
      result.tonnageKnownSets++;
    }
    if (set.distanceM != null) result.distanceM = (result.distanceM ?? 0) + set.distanceM;
    if (set.timeS != null) result.durationS = (result.durationS ?? 0) + set.timeS;
    if (set.groundContacts != null) result.groundContacts = (result.groundContacts ?? 0) + set.groundContacts;
  }
  return result;
};
