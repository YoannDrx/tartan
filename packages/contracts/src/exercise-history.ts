import { z } from "zod";
import { detailedSetInput } from "./requests";
import { isoDate, prescriptionSchema, snapshotItem, uuid } from "./session";
import { strengthReferenceResponse } from "./strength";

export const exerciseHistoryQuery = z
  .object({ from: isoDate, to: isoDate })
  .refine(({ from, to }) => from <= to && Date.parse(to) - Date.parse(from) <= 365 * 86_400_000, {
    message: "Choisis une période de 366 jours maximum.",
    path: ["to"],
  });
export type ExerciseHistoryQuery = z.infer<typeof exerciseHistoryQuery>;

export const actualVolumesResponse = z.object({
  tonnageKg: z.number().nullable(),
  distanceM: z.number().nullable(),
  durationS: z.number().nullable(),
  groundContacts: z.number().nullable(),
  completedWorkSets: z.number().int(),
  tonnageKnownSets: z.number().int(),
});
export const exerciseHistoryItem = z.object({
  itemRef: z.string(),
  name: z.string(),
  prescription: prescriptionSchema,
  resolvedLoadKg: z.number().nullable(),
  strengthLoadKind: snapshotItem.shape.strengthLoadKind,
  strengthReference: snapshotItem.shape.strengthReference,
  sets: z.array(detailedSetInput),
});
export const exerciseHistorySession = z.object({
  sessionId: uuid,
  logId: uuid,
  date: isoDate,
  title: z.string(),
  version: z.number().int(),
  recordedBy: uuid.nullable(),
  updatedAt: z.string(),
  status: z.enum(["done", "partial"]),
  items: z.array(exerciseHistoryItem),
  volumes: actualVolumesResponse,
});
export const exerciseHistoryResponse = z.object({
  exercise: strengthReferenceResponse.shape.exercise.extend({ archived: z.boolean() }),
  reference: strengthReferenceResponse.shape.reference,
  tests: strengthReferenceResponse.shape.tests,
  from: isoDate,
  to: isoDate,
  sessions: z.array(exerciseHistorySession),
  coverage: z.object({
    totalSessions: z.number().int(),
    returnedSessions: z.number().int(),
    detailedSessions: z.number().int(),
    unusableSets: z.number().int(),
    limitSessions: z.number().int(),
    truncated: z.boolean(),
  }),
});
export type ExerciseHistory = z.infer<typeof exerciseHistoryResponse>;
export type ExerciseHistorySession = z.infer<typeof exerciseHistorySession>;

export const athleteExerciseIndex = z.array(
  z.object({
    id: uuid,
    name: z.string(),
    archived: z.boolean(),
    hasRealizedSets: z.boolean(),
    hasStrengthTests: z.boolean(),
    hasStrengthReference: z.boolean().default(false),
  }),
);

export const athleteHistoryContext = z.object({
  athlete: z.object({ id: uuid, firstName: z.string(), lastName: z.string() }),
  exercises: athleteExerciseIndex,
  today: isoDate,
});
