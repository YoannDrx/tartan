import { z } from "zod";
import { uuid } from "./session";

export const legacyStrengthKey = z.enum([
  "back_squat",
  "front_squat",
  "clean",
  "snatch",
  "deadlift",
  "hip_thrust",
  "bench_press",
  "pull_up",
]);

export const chooseStrengthReference = z.discriminatedUnion("source", [
  z.object({ source: z.literal("test"), testId: uuid }),
  z.object({ source: z.literal("working"), valueKg: z.number().min(0.01).max(1000).multipleOf(0.01) }),
]);
export type ChooseStrengthReference = z.infer<typeof chooseStrengthReference>;

export const legacyStrengthMappingInput = z.object({
  legacyKey: legacyStrengthKey,
  exerciseId: uuid,
  reason: z.string().trim().min(10).max(500),
  confirmed: z.literal(true),
});

export const strengthReferenceResponse = z.object({
  exercise: z.object({ id: uuid, name: z.string(), loadKind: z.string().nullable(), stepKg: z.number() }),
  reference: z
    .object({
      id: uuid,
      valueKg: z.number(),
      kind: z.enum(["tested", "estimated", "working"]),
      sourceTestId: uuid.nullable(),
      selectedAt: z.string(),
    })
    .nullable(),
  tests: z.array(
    z.object({
      id: uuid,
      exerciseKey: z.string(),
      value: z.number(),
      kind: z.string(),
      date: z.string(),
      loadKind: z.string().nullable(),
    }),
  ),
});

export type LegacyStrengthMappingInput = z.infer<typeof legacyStrengthMappingInput>;
export const strengthMappingReportResponse = z.object({
  unmapped: z.array(z.object({ legacyKey: z.string(), count: z.number().int().nonnegative() })),
  mappings: z.array(
    z.object({
      legacyKey: z.string(),
      exerciseId: uuid,
      reason: z.string(),
      exerciseName: z.string(),
      loadKind: z.string().nullable(),
    }),
  ),
});
export type StrengthMappingReport = z.infer<typeof strengthMappingReportResponse>;
