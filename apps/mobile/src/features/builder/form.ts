import { m } from "@tartan/i18n";
import {
  clockTime,
  isoDate,
  prescriptionSchema,
  saveScheduledSessionInput,
  type Prescription,
  type SaveScheduledSessionInput,
} from "@tartan/contracts";

export const numericFields = [
  "sets",
  "reps",
  "distance_m",
  "duration_s",
  "rest_s",
  "ground_contacts",
  "count",
  "height_cm",
] as const;
export type PrescriptionFields = Record<
  (typeof numericFields)[number] | "loadValue" | "intensityValue" | "tempo" | "notes" | "unit" | "test",
  string
> & {
  loadType: "none" | "kg" | "pct_1rm";
  intensityType: "none" | "rpe" | "rir";
};
const decimal = (text: string) => (/^\d+(?:[.,]\d+)?$/.test(text.trim()) ? Number(text.trim().replace(",", ".")) : NaN);
export const prescriptionFields = (value: Prescription): PrescriptionFields =>
  ({
    ...Object.fromEntries(numericFields.map((key) => [key, value[key] === undefined ? "" : String(value[key])])),
    loadType: value.load?.type ?? "none",
    loadValue: value.load ? String(value.load.value) : "",
    test: value.load?.type === "pct_1rm" ? value.load.test : "",
    intensityType: value.intensityTarget?.type ?? "none",
    intensityValue: value.intensityTarget ? String(value.intensityTarget.value) : "",
    tempo: value.tempo ?? "",
    notes: value.notes ?? "",
    unit: value.unit ?? "",
  }) as PrescriptionFields;
export const parsePrescriptionFields = (v: PrescriptionFields) =>
  prescriptionSchema.safeParse({
    ...Object.fromEntries(numericFields.map((key) => [key, v[key].trim() === "" ? undefined : decimal(v[key])])),
    load:
      v.loadType === "none"
        ? undefined
        : { type: v.loadType, value: decimal(v.loadValue), ...(v.loadType === "pct_1rm" ? { test: v.test } : {}) },
    intensityTarget:
      v.intensityType === "none" ? undefined : { type: v.intensityType, value: decimal(v.intensityValue) },
    tempo: v.tempo || undefined,
    notes: v.notes || undefined,
    unit: v.unit || undefined,
  });

export const localSchedule = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const scheduleToUtc = (local: string | null): string | null => {
  if (!local) return null;
  const [date, time] = local.split("T");
  if (!isoDate.safeParse(date).success || !clockTime.safeParse(time).success) return local;
  const value = new Date(`${local}:00`);
  // Un horaire inexistant lors du changement d'heure ne peut pas être normalisé silencieusement.
  if (!Number.isFinite(value.getTime()) || localSchedule(value.toISOString()) !== local) return local;
  return value.toISOString();
};

export const parseSessionForm = (input: SaveScheduledSessionInput, duration: string) =>
  saveScheduledSessionInput.safeParse({
    ...input,
    publishAt: scheduleToUtc(input.publishAt),
    draft: { ...input.draft, durationMin: duration.trim() === "" ? null : decimal(duration) },
  });

export const builderErrors = (issues: { path: PropertyKey[] }[]): string => {
  const labels: Record<string, string> = {
    title: m.builder.titleLabel,
    date: m.builder.date,
    startTime: m.builder.time,
    publishAt: m.builder.scheduleAt,
    durationMin: m.builder.duration,
    coachNote: m.builder.coachNote,
    location: m.builder.location,
    blocks: m.builder.body,
    name: m.nativeBuilder.blockName,
    assignments: m.builder.audience,
    sets: m.builder.sets,
    reps: m.builder.reps,
    distance_m: m.builder.distance,
    duration_s: m.builder.durationS,
    rest_s: m.builder.rest,
    ground_contacts: m.builder.contacts,
    count: m.nativeBuilder.count,
    height_cm: m.nativeBuilder.height,
    load: m.builder.load,
    intensityTarget: m.nativeBuilder.intensity,
    test: m.builder.test,
    tempo: m.builder.tempo,
    notes: m.builder.notes,
    unit: m.nativeBuilder.unit,
  };
  return m.nativeBuilder.invalidFields(
    [
      ...new Set(
        issues.map(
          (i) =>
            [...i.path]
              .reverse()
              .map((part) => labels[String(part)])
              .find(Boolean) ?? m.builder.body,
        ),
      ),
    ].join(", "),
  );
};
