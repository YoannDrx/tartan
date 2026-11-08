import { fr } from "./fr";

export const historyNumber = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
export const historyDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));

export const strengthCurveLabel = (curve: {
  source: keyof typeof fr.strengthHistory.sources;
  convention: "external_total" | "added_weight";
  reps: number | null;
  repetitionScope: "total" | "per_side" | null;
  sideCount: number | null;
}) =>
  [
    fr.strengthHistory.sources[curve.source],
    curve.reps === null ? null : fr.strengthHistory.atReps(curve.reps),
    fr.strength.conventions[curve.convention],
    curve.repetitionScope === "per_side"
      ? fr.exerciseHistory.perSide(curve.sideCount ?? 1)
      : curve.repetitionScope === "total"
        ? fr.progression.totalReps.toLowerCase()
        : null,
  ]
    .filter(Boolean)
    .join(" · ");
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

export const strengthRecordLabel = (record: {
  kind: keyof typeof fr.strengthRecords.kinds;
  reps: number;
  loadKg: number;
}) =>
  record.kind === "load_at_reps"
    ? fr.strengthRecords.loadAtReps(record.reps)
    : record.kind === "reps_at_load"
      ? fr.strengthRecords.repsAtLoad(historyNumber(record.loadKg))
      : fr.strengthRecords.kinds.estimated_one_rm;
export const strengthRecordConvention = (record: {
  convention: keyof typeof fr.strength.conventions;
  repetitionScope: "total" | "per_side";
  sideCount: number;
}) =>
  `${fr.strength.conventions[record.convention]} · ${record.repetitionScope === "per_side" ? fr.exerciseHistory.perSide(record.sideCount) : fr.progression.totalReps.toLowerCase()}`;
