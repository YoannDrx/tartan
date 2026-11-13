import { z } from "zod";

export const exerciseFamily = z.enum([
  "strength",
  "weightlifting",
  "mobility",
  "plyometrics",
  "running",
  "core",
  "coordination",
  "stairs",
  "warmup",
]);

export const catalogueKey = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const instruction = z.string().trim().min(1).max(600);

export const exerciseGuide = z.object({
  catalogKey: catalogueKey,
  version: z.number().int().positive(),
  family: exerciseFamily,
  level: z.enum(["beginner", "intermediate", "advanced"]),
  objective: instruction,
  setup: z.array(instruction).min(1).max(8),
  steps: z.array(instruction).min(2).max(10),
  breathing: instruction.nullable(),
  mistakes: z.array(instruction).min(1).max(6),
  easier: instruction.nullable(),
  progression: instruction.nullable(),
  counting: z.object({
    unit: z.enum(["repetitions", "seconds", "meters", "contacts", "steps"]),
    sides: z.enum(["total", "each_side", "alternating_total"]),
    explanation: instruction,
  }),
  loadExplanation: instruction,
  illustration: z.object({
    status: z.enum(["draft", "ready"]),
    path: z.string().regex(/^\/exercise-guides\/[a-z0-9-]+-v[1-9][0-9]*\.svg$/),
    alt: instruction,
    positions: z.array(instruction).min(2).max(6),
    source: z.literal("tartan-original"),
    rights: z.literal("Tartan"),
  }),
  // Une fiche complète n'est pas une preuve de validation humaine du geste.
  technicalReview: z.enum(["pending", "approved"]),
});

export type ExerciseGuide = z.infer<typeof exerciseGuide>;
export type ExerciseFamily = z.infer<typeof exerciseFamily>;
