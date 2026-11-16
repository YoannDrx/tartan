import { z } from "zod";
import { m } from "@tartan/i18n";
import {
  clockTime,
  isoDate,
  prescriptionSchema,
  saveScheduledSessionInput,
  type PlannedSet,
  type Prescription,
  type SaveScheduledSessionInput,
} from "@tartan/contracts";
import { withSetPlan } from "@tartan/domain";

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
/** Une série détaillée en cours de saisie : les nombres restent du texte tant que la saisie n'est pas validée. */
export type PlannedSetFields = { reps: string; load: string; warmup: boolean };
export type PrescriptionFields = Record<
  (typeof numericFields)[number] | "loadValue" | "intensityValue" | "tempo" | "notes" | "unit" | "test",
  string
> & {
  loadType: "none" | "kg" | "pct_1rm";
  intensityType: "none" | "rpe" | "rir";
  // Série par série (pyramide, échauffement) : absent pour une prescription uniforme.
  setPlan?: PlannedSetFields[];
};
export const MAX_PLANNED_SETS = 30;
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
    ...(value.setPlan ? { setPlan: value.setPlan.map(plannedSetFields) } : {}),
  }) as PrescriptionFields;

export const plannedSetFields = (set: PlannedSet): PlannedSetFields => ({
  reps: set.reps === undefined ? "" : String(set.reps),
  load: set.load ? String(set.load.value) : "",
  warmup: Boolean(set.warmup),
});

/** Le point de départ d'un détail : autant de séries que prescrites, toutes identiques à la saisie en cours. */
export const startSetPlanFields = (v: PrescriptionFields): PlannedSetFields[] => {
  const count = /^\d+$/.test(v.sets.trim()) ? Number(v.sets.trim()) : 3;
  return Array.from({ length: Math.min(Math.max(count, 1), MAX_PLANNED_SETS) }, () => ({
    reps: v.reps,
    load: v.loadType === "none" ? "" : v.loadValue,
    warmup: false,
  }));
};

const plannedSets = (v: PrescriptionFields): PlannedSet[] | undefined =>
  v.setPlan?.map((set) => ({
    ...(set.reps.trim() === "" ? {} : { reps: decimal(set.reps) }),
    ...(v.loadType === "none" || set.load.trim() === ""
      ? {}
      : {
          load:
            v.loadType === "kg"
              ? { type: "kg" as const, value: decimal(set.load) }
              : { type: "pct_1rm" as const, value: decimal(set.load), test: v.test },
        }),
    ...(set.warmup ? { warmup: true } : {}),
  }));
export const parsePrescriptionFields = (v: PrescriptionFields) => {
  const plan = plannedSets(v);
  // Avec un détail, les séries, les répétitions et la charge viennent de lui (première série de travail).
  const detailed = new Set<string>(plan ? ["sets", "reps"] : []);
  const unitValue = plan ? (v.setPlan?.find((set) => set.load.trim() !== "")?.load ?? "") : v.loadValue;
  const base = {
    ...Object.fromEntries(
      numericFields.map((key) => [
        key,
        detailed.has(key) || v[key].trim() === "" ? undefined : decimal(v[key]),
      ]),
    ),
    load:
      v.loadType === "none" || (plan && unitValue.trim() === "")
        ? undefined
        : { type: v.loadType, value: decimal(unitValue), ...(v.loadType === "pct_1rm" ? { test: v.test } : {}) },
    intensityTarget:
      v.intensityType === "none" ? undefined : { type: v.intensityType, value: decimal(v.intensityValue) },
    tempo: v.tempo || undefined,
    notes: v.notes || undefined,
    unit: v.unit || undefined,
  } as Prescription;
  return prescriptionSchema.safeParse(plan?.length ? withSetPlan(base, plan) : base);
};

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
    setPlan: m.builder.setPlan.title,
    warmup: m.builder.setPlan.warmup,
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

export const prescriptionFieldsSchema = z.object({
  sets: z.string().max(100),
  reps: z.string().max(100),
  distance_m: z.string().max(100),
  duration_s: z.string().max(100),
  rest_s: z.string().max(100),
  ground_contacts: z.string().max(100),
  count: z.string().max(100),
  height_cm: z.string().max(100),
  loadValue: z.string().max(100),
  intensityValue: z.string().max(100),
  tempo: z.string().max(20),
  notes: z.string().max(500),
  unit: z.string().max(30),
  test: z.string().max(60),
  loadType: z.enum(["none", "kg", "pct_1rm"]),
  intensityType: z.enum(["none", "rpe", "rir"]),
  setPlan: z
    .array(z.object({ reps: z.string().max(100), load: z.string().max(100), warmup: z.boolean() }))
    .min(1)
    .max(MAX_PLANNED_SETS)
    .optional(),
});
