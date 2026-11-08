import { fr } from "./fr";

export const historyNumber = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
export const historyDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));
export const realizedSetLabel = (
  set: {
    done: boolean;
    setKind: "work" | "warmup";
    loadKind: "external" | "bodyweight" | "assisted";
    reps?: number | null;
    loadKg?: number | null;
    distanceM?: number | null;
    timeS?: number | null;
    groundContacts?: number | null;
    repetitionScope: "total" | "per_side";
    sideCount: number;
  },
  convention?: string | null,
) => {
  if (!set.done) return fr.exerciseHistory.notConfirmed;
  const values = [
    fr.progression[set.setKind],
    set.reps == null
      ? null
      : `${historyNumber(set.reps)} ${fr.progression.fields.reps.toLowerCase()} (${set.repetitionScope === "total" ? fr.progression.totalReps.toLowerCase() : fr.exerciseHistory.perSide(set.sideCount)})`,
    set.loadKind === "external" && convention === "added_weight"
      ? fr.strength.conventions.added_weight
      : fr.progression[set.loadKind],
    set.loadKg == null ? null : `${historyNumber(set.loadKg)} kg`,
    set.distanceM == null ? null : `${historyNumber(set.distanceM)} m`,
    set.timeS == null ? null : `${historyNumber(set.timeS)} s`,
    set.groundContacts == null
      ? null
      : `${historyNumber(set.groundContacts)} ${fr.progression.fields.groundContacts.toLowerCase()}`,
  ];
  return values.filter(Boolean).join(" · ");
};
