import { z } from "zod";
import { sessionVariant } from "./enums";

const numericText = z.string().max(32);
export const performedSetDraftRow = z.object({
  itemRef: z.string().min(1).max(100),
  setIndex: z.number().int().min(0).max(100),
  done: z.boolean(),
  setKind: z.enum(["work", "warmup"]),
  loadKind: z.enum(["", "external", "bodyweight", "assisted"]),
  repetitionScope: z.enum(["total", "per_side"]),
  sideCount: z.union([z.literal(1), z.literal(2)]),
  reps: numericText,
  loadKg: numericText,
  distanceM: numericText,
  timeS: numericText,
  groundContacts: numericText,
});
export type PerformedSetDraftRow = z.infer<typeof performedSetDraftRow>;
export const performedSetsDraft = z.object({
  format: z.literal(1),
  sessionVersion: z.number().int().min(1),
  logVersion: z.number().int().min(0),
  variant: sessionVariant,
  status: z.enum(["done", "partial"]),
  submittedClientId: z.string().max(64).optional(),
  rows: z.array(performedSetDraftRow).max(500),
});
export type PerformedSetsDraft = z.infer<typeof performedSetsDraft>;
