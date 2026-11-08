import { z } from "zod";
import { isoDate, uuid } from "./session";

export const strengthRecordValue = z.object({
  comparisonKey: z.string(),
  exerciseId: uuid,
  exerciseName: z.string(),
  kind: z.enum(["load_at_reps", "reps_at_load", "estimated_one_rm"]),
  value: z.number().finite().nonnegative(),
  reps: z.number().int().positive(),
  loadKg: z.number().finite().nonnegative(),
  convention: z.enum(["external_total", "added_weight"]),
  repetitionScope: z.enum(["total", "per_side"]),
  sideCount: z.union([z.literal(1), z.literal(2)]),
  sessionId: uuid,
  logId: uuid,
  itemRef: z.string(),
  setIndex: z.number().int().nonnegative(),
  date: isoDate,
  baseline: z.boolean(),
});
export type StrengthRecordValue = z.infer<typeof strengthRecordValue>;
export const confirmedStrengthRecord = strengthRecordValue.extend({
  eventId: z.string(),
  logVersion: z.number().int().positive(),
  previousValue: z.number().finite().nonnegative(),
});
export type ConfirmedStrengthRecord = z.infer<typeof confirmedStrengthRecord>;
