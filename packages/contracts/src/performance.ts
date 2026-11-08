import { z } from "zod";
import { isoDate, uuid } from "./session";

export const performanceMeasurement = z.enum(["time", "distance"]);
export const performanceDirection = z.enum(["lower", "higher"]);
export const performanceFields = z.object({
  athleteId: uuid,
  discipline: z.string().trim().min(1, "Choisis la discipline").max(40),
  mark: z.number().positive("Indique la marque").max(100000).multipleOf(0.001),
  unit: z.enum(["cm", "m", "s"]),
  measurementType: performanceMeasurement.optional(),
  recordDirection: performanceDirection.optional(),
  comparisonContext: z.string().trim().max(80).optional(),
  wind: z.number().min(-20).max(20).multipleOf(0.1).nullable().optional(),
  date: isoDate,
  location: z.string().trim().max(120).nullable().optional(),
  competitionId: uuid.nullable().optional(),
});
const validRule = (input: z.infer<typeof performanceFields>) => {
  const type = input.measurementType ?? (input.unit === "s" ? "time" : "distance");
  const direction = input.recordDirection ?? (type === "time" ? "lower" : "higher");
  return type === "time" ? input.unit === "s" && direction === "lower" : input.unit !== "s" && direction === "higher";
};
const ruleError = {
  message: "Le type de mesure, l’unité et le sens de progression doivent correspondre.",
  path: ["measurementType"],
};
export const performanceInput = performanceFields.extend({ clientId: uuid.optional() }).refine(validRule, ruleError);
export type PerformanceInput = z.infer<typeof performanceInput>;
export const updatePerformanceInput = performanceFields
  .extend({ id: uuid, expectedVersion: z.number().int().positive() })
  .refine(validRule, ruleError);
export type UpdatePerformanceInput = z.infer<typeof updatePerformanceInput>;
export const performanceWriteResult = z.object({ id: uuid, version: z.number().int().positive() });

// Champs ajoutés facultatifs en réponse pour permettre un client récent face à l'ancien serveur.
export const performanceEntry = z.object({
  id: uuid,
  discipline: z.string(),
  mark: z.number(),
  unit: z.string(),
  date: z.string(),
  location: z.string().nullable(),
  isPb: z.boolean(),
  wind: z.number().nullable().optional(),
  competitionId: uuid.nullable().optional(),
  measurementType: performanceMeasurement.nullable().optional(),
  recordDirection: performanceDirection.nullable().optional(),
  comparisonContext: z.string().optional(),
  version: z.number().int().positive().optional(),
  isBaseline: z.boolean().optional(),
});
export type PerformanceEntry = z.infer<typeof performanceEntry>;
