import { z } from "zod";
import { isoDate, uuid } from "./session";

export const trainingPhaseKind = z.enum([
  "general",
  "development",
  "intensification",
  "taper",
  "competition",
  "recovery",
  "custom",
]);
export const trainingPhaseTarget = z.object({ type: z.enum(["group", "athlete"]), id: uuid }).strict();
export const trainingPhaseFields = z.object({
  target: trainingPhaseTarget,
  name: z.string().trim().min(1).max(100),
  kind: trainingPhaseKind,
  startDate: isoDate,
  endDate: isoDate,
  objective: z.string().trim().max(300),
  description: z.string().trim().max(4000),
  privateNote: z.string().trim().max(4000),
});
export const saveTrainingPhaseInput = trainingPhaseFields
  .extend({ id: uuid, expectedVersion: z.number().int().nonnegative() })
  .strict()
  .refine((p) => p.startDate <= p.endDate, { path: ["endDate"], message: "La fin doit suivre le début de la phase." });
export type SaveTrainingPhaseInput = z.infer<typeof saveTrainingPhaseInput>;
export const trainingPhaseVersion = z.object({ expectedVersion: z.number().int().positive() }).strict();
export const trainingPhaseVisibilityInput = trainingPhaseVersion.extend({ shared: z.boolean() });
export const trainingPhaseQuery = z
  .object({ from: isoDate, to: isoDate, groupId: uuid.optional(), athleteId: uuid.optional() })
  .strict()
  .refine((p) => p.from <= p.to, { path: ["to"], message: "La fin doit suivre le début de la période." });
export type TrainingPhaseQuery = z.infer<typeof trainingPhaseQuery>;
export const trainingPhaseSummary = trainingPhaseFields.omit({ privateNote: true }).extend({
  id: uuid,
  targetName: z.string(),
  version: z.number().int().positive(),
  shared: z.boolean(),
  privateNote: z.string().optional(),
});
export type TrainingPhaseSummary = z.infer<typeof trainingPhaseSummary>;
export const trainingPhaseList = z.object({ phases: z.array(trainingPhaseSummary), canManage: z.boolean() });
export const trainingPhaseContext = z.object({
  groups: z.array(z.object({ id: uuid, name: z.string() })),
  athletes: z.array(z.object({ id: uuid, name: z.string(), groupIds: z.array(uuid) })),
});
export type TrainingPhaseContext = z.infer<typeof trainingPhaseContext>;
export const trainingPhaseWriteResult = z.object({ id: uuid, version: z.number().int().positive() });

export const phasePlanningQuery = z
  .object({
    date: isoDate,
    groupIds: z.array(uuid).max(100),
    athleteIds: z.array(uuid).max(500),
    choices: z
      .array(z.object({ athleteId: uuid, groupId: uuid }).strict())
      .max(500)
      .default([]),
  })
  .strict()
  .refine((input) => new Set(input.choices.map((choice) => choice.athleteId)).size === input.choices.length, {
    path: ["choices"],
    message: "Un seul contexte par athlète.",
  });
export type PhasePlanningQuery = z.infer<typeof phasePlanningQuery>;
// Le contexte de programmation ne contient pas la note privée, même pour le coach.
export const planningPhase = trainingPhaseSummary.omit({ privateNote: true });
export const phasePlanningResult = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("phase"), phase: planningPhase }),
  z.object({ kind: z.literal("choose_group"), phases: z.array(planningPhase) }),
]);
export const phasePlanningResponse = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  date: isoDate,
  groups: z.array(z.object({ id: uuid, name: z.string(), phase: planningPhase.nullable() })),
  athletes: z.array(z.object({ id: uuid, name: z.string(), result: phasePlanningResult })),
});
export type PhasePlanningResponse = z.infer<typeof phasePlanningResponse>;
