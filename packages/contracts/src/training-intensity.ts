import { z } from "zod";
import { uuid } from "./session";

export const intensityMetric = z.enum(["kg", "pct_reference", "target_rpe", "target_rir"]);
export type IntensityMetric = z.infer<typeof intensityMetric>;
export const intensitySummary = z.object({
  count: z.number().int().nonnegative(),
  eligible: z.number().int().nonnegative(),
  mean: z.number().nonnegative().nullable(),
  min: z.number().nonnegative().nullable(),
  max: z.number().nonnegative().nullable(),
});
export type IntensitySummary = z.infer<typeof intensitySummary>;
export const intensityRow = z.object({
  key: z.string(),
  exerciseId: uuid,
  name: z.string(),
  metric: intensityMetric,
  loadKind: z.enum(["external_total", "added_weight", "assistance", "bodyweight"]).nullable(),
  planned: intensitySummary,
  actual: intensitySummary.nullable(),
});
export const intensityAnalysis = z.object({
  rows: z.array(intensityRow),
  unlinkedItems: z.number().int().nonnegative(),
  unmatchedWorkSets: z.number().int().nonnegative(),
});
export type IntensityAnalysis = z.infer<typeof intensityAnalysis>;
