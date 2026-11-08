import { z } from "zod";
import { isoDate, uuid } from "./session";

export const trainingAnalysisQuery = z
  .object({
    from: isoDate,
    to: isoDate,
    athleteId: uuid.optional(),
    groupId: uuid.optional(),
    phaseId: uuid.optional(),
  })
  .strict()
  .refine((q) => q.from <= q.to && (Date.parse(q.to) - Date.parse(q.from)) / 86400000 < 366, {
    message: "Choisis une période de un à 366 jours.",
  });
export type TrainingAnalysisQuery = z.infer<typeof trainingAnalysisQuery>;
const count = z.number().int().nonnegative();
const value = z.number().nonnegative().nullable();
export const analysisVolumes = z.object({
  tonnageKg: value,
  distanceM: value,
  durationS: value,
  groundContacts: value,
});
const coverage = z.object({ tonnageKg: count, distanceM: count, durationS: count, groundContacts: count });
export const analysisTotals = z.object({
  assignedSessions: count,
  loggedSessions: count,
  completedSessions: count,
  detailedSessions: count,
  frozenSessions: count,
  plannedItems: count,
  plannedSets: count,
  plannedSetsKnownItems: count,
  completedWorkSets: count,
  planned: analysisVolumes,
  actual: analysisVolumes,
  plannedKnownItems: coverage,
  actualKnownSets: coverage,
  perceivedLoad: value,
  loadResponses: count,
  healthEligibleSessions: count,
});
export type AnalysisTotals = z.infer<typeof analysisTotals>;
export const analysisExercise = z.object({
  key: z.string(),
  exerciseId: uuid.nullable(),
  name: z.string(),
  category: z.string(),
  occurrences: count,
  plannedSets: count,
  completedWorkSets: count,
});
export const analysisClassificationRow = z.object({
  key: z.string(),
  occurrences: count,
  plannedSets: count,
  plannedSetsKnownItems: count,
  completedWorkSets: count,
});
export const analysisClassification = z.object({
  items: count,
  movementKnownItems: count,
  equipmentKnownItems: count,
  movements: z.array(analysisClassificationRow),
  equipment: z.array(analysisClassificationRow),
});
export type AnalysisClassification = z.infer<typeof analysisClassification>;
export const trainingAnalysisResponse = z.object({
  from: isoDate,
  to: isoDate,
  previousFrom: isoDate,
  previousTo: isoDate,
  phase: z
    .object({
      id: uuid,
      name: z.string(),
      basis: z.enum(["prescription", "shared_period"]).default("shared_period"),
      coverage: z.object({ matched: count, withoutReference: count, otherPhase: count }).optional(),
    })
    .nullable(),
  classification: analysisClassification.optional(),
  athleteCount: count,
  healthVisible: z.boolean(),
  totals: analysisTotals,
  previous: analysisTotals,
  weeks: z.array(z.object({ weekStart: isoDate, totals: analysisTotals })),
  exercises: z.array(analysisExercise),
  categories: z.array(
    z.object({ category: z.string(), occurrences: count, plannedSets: count, completedWorkSets: count }),
  ),
  diversity28Days: z.object({
    from: isoDate,
    to: isoDate,
    distinctExercises: count,
    occurrences: count,
    unidentifiedItems: count,
  }),
});
export type TrainingAnalysis = z.infer<typeof trainingAnalysisResponse>;
export const trainingAnalysisContext = z.object({
  today: isoDate,
  groups: z.array(z.object({ id: uuid, name: z.string() })),
  athletes: z.array(z.object({ id: uuid, name: z.string() })),
  phases: z.array(
    z.object({ id: uuid, name: z.string(), targetName: z.string(), startDate: isoDate, endDate: isoDate }),
  ),
});
