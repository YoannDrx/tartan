import { z } from "zod";
import {
  clockTime,
  isoDate,
  uuid,
  sessionPhaseChoice,
  sessionPhaseReview,
  saveScheduledSessionInput,
  prescriptionSchema,
} from "./session";
import { sessionType } from "./enums";

// Schéma du prestataire : toutes les clés sont requises, les absences sont explicites.
// Aucun identifiant de personne, maximum individuel ou outil d’écriture dans ce contrat.
const nullableNumber = (min: number, max: number) => z.number().min(min).max(max).nullable();
const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();
export const plannerPrescription = z
  .object({
    sets: nullableInt(1, 50),
    reps: nullableInt(1, 500),
    distanceM: nullableNumber(0, 20000),
    durationS: nullableInt(0, 14400),
    restS: nullableInt(0, 3600),
    load: z
      .object({ type: z.enum(["kg", "pct_1rm"]), value: z.number().min(0).max(1000) })
      .strict()
      .nullable(),
    intensityTarget: z
      .object({ type: z.enum(["rpe", "rir"]), value: z.number().min(0).max(10) })
      .strict()
      .nullable(),
    tempo: z.string().max(20).nullable(),
    contacts: nullableInt(0, 2000),
    notes: z.string().max(500).nullable(),
  })
  .strict();
export const plannerItem = z
  .object({
    // Jeton de la bibliothèque autorisée ; le service le traduit en exerciseId après validation.
    exerciseToken: z.string().min(1).max(60),
    prescription: plannerPrescription,
    // Citation de la consigne ; hypothèses et suggestions sont affichées séparément.
    instruction: z.string().min(1).max(2000),
  })
  .strict();
export const plannerSession = z
  .object({
    date: isoDate,
    startTime: clockTime.nullable(),
    title: z.string().min(1).max(120),
    type: sessionType,
    durationMin: nullableInt(1, 600),
    targetTokens: z.array(z.string().min(1).max(60)).min(1).max(200),
    blocks: z
      .array(
        z
          .object({
            name: z.string().min(1).max(80),
            items: z.array(plannerItem).min(1).max(60),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();
export const plannerQuestion = z
  .object({
    id: z.string().min(1).max(60),
    field: z.enum(["target", "date", "exercise", "unit", "rest", "load", "other"]),
    question: z.string().min(1).max(500),
    options: z.array(z.string().min(1).max(200)).max(5),
  })
  .strict();
// Objet racine simple pour la sortie structurée stricte ; la cohérence de status
// et des listes est vérifiée dans le domaine, pas confiée au modèle.
export const plannerInterpretation = z
  .object({
    status: z.enum(["clarification", "proposal"]),
    questions: z.array(plannerQuestion).max(10),
    sessions: z.array(plannerSession).max(14),
    assumptions: z.array(z.string().min(1).max(500)).max(20),
    suggestions: z.array(z.string().min(1).max(500)).max(20),
  })
  .strict();
export type PlannerInterpretation = z.infer<typeof plannerInterpretation>;
export type PlannerPrescription = z.infer<typeof plannerPrescription>;

export const plannerPeriod = z
  .object({ from: isoDate, to: isoDate })
  .strict()
  .refine((p) => p.from <= p.to && Date.parse(`${p.to}T00:00:00Z`) - Date.parse(`${p.from}T00:00:00Z`) <= 6 * 86400000);

export const plannerSelection = z
  .object({
    period: plannerPeriod,
    groupIds: z.array(uuid).max(100),
    athleteIds: z.array(uuid).max(200),
    exerciseIds: z.array(uuid).max(500),
    phaseChoices: z.array(sessionPhaseChoice).max(500),
    // Additif : les anciennes demandes conservent le choix commun à la période.
    phaseChoicesByDate: z
      .array(
        z
          .object({
            date: isoDate,
            choices: z.array(sessionPhaseChoice).max(500),
          })
          .strict(),
      )
      .max(7)
      .optional(),
  })
  .strict()
  .refine(
    (s) =>
      s.groupIds.length + s.athleteIds.length > 0 &&
      s.groupIds.length + s.athleteIds.length <= 200 &&
      [s.groupIds, s.athleteIds, s.exerciseIds].every((ids) => new Set(ids).size === ids.length) &&
      new Set(s.phaseChoices.map((c) => c.athleteId)).size === s.phaseChoices.length &&
      new Set(s.phaseChoicesByDate?.map((c) => c.date)).size === (s.phaseChoicesByDate?.length ?? 0) &&
      (s.phaseChoicesByDate ?? []).every(
        (day) =>
          day.date >= s.period.from &&
          day.date <= s.period.to &&
          new Set(day.choices.map((c) => c.athleteId)).size === day.choices.length,
      ),
  );
export type PlannerSelection = z.infer<typeof plannerSelection>;
export const createPlannerProposalInput = z
  .object({
    id: uuid,
    requestedAt: z.iso.datetime(),
    selection: plannerSelection,
    text: z.string().trim().min(1).max(12000),
    reviewed: z.literal(true),
  })
  .strict();
export type CreatePlannerProposalInput = z.infer<typeof createPlannerProposalInput>;
export const clarifyPlannerProposalInput = z
  .object({
    operationId: uuid,
    expectedVersion: z.number().int().positive(),
    text: z.string().trim().min(1).max(12000),
    reviewed: z.literal(true),
  })
  .strict();
export type ClarifyPlannerProposalInput = z.infer<typeof clarifyPlannerProposalInput>;

export const plannerReviewedDraft = saveScheduledSessionInput
  .omit({ id: true, expectedVersion: true })
  .extend({ publishAt: z.null() })
  .strict();
export type PlannerReviewedDraft = z.infer<typeof plannerReviewedDraft>;
export const confirmPlannerProposalInput = z
  .object({
    expectedVersion: z.number().int().positive(),
    confirmed: z.literal(true),
    sessions: z.array(plannerReviewedDraft).min(1).max(14),
  })
  .strict();
export type ConfirmPlannerProposalInput = z.infer<typeof confirmPlannerProposalInput>;

export const preparePlannerDraftsInput = z.object({ expectedVersion: z.number().int().positive() }).strict();
const plannerCreatedSessions = z
  .array(z.object({ id: uuid, version: z.number().int().positive() }))
  .min(1)
  .max(14);
export const plannerConfirmationResult = z.object({ sessions: plannerCreatedSessions });
export const plannerDraftsResponse = z.object({
  proposalId: uuid,
  version: z.number().int().positive(),
  sessions: z.array(plannerReviewedDraft).min(1).max(14),
});
export type PlannerDraftsResponse = z.infer<typeof plannerDraftsResponse>;
export const previewPlannerLoadsInput = z
  .object({
    expectedVersion: z.number().int().positive(),
    session: plannerReviewedDraft,
    afterAthleteId: uuid.optional(),
  })
  .strict();
export type PreviewPlannerLoadsInput = z.infer<typeof previewPlannerLoadsInput>;
export const plannerLoadsPreview = z.object({
  athleteCount: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  nextCursor: uuid.nullable(),
  athletes: z
    .array(
      z.object({
        id: uuid,
        name: z.string(),
        items: z.array(
          z.object({
            ref: z.string(),
            exerciseId: uuid,
            name: z.string(),
            prescription: prescriptionSchema,
            resolvedLoadKg: z.number().nonnegative().nullable(),
            source: z.object({ value: z.number(), kind: z.string(), date: isoDate }).nullable(),
          }),
        ),
      }),
    )
    .max(10),
});
export type PlannerLoadsPreview = z.infer<typeof plannerLoadsPreview>;
export const plannerProposalResponse = z.object({
  id: uuid,
  version: z.number().int().positive(),
  state: z.enum(["processing", "clarification", "proposal", "failed", "committed"]),
  clarificationCount: z.number().int().min(0).max(5),
  expiresAt: z.iso.datetime(),
  selection: plannerSelection,
  messages: z.array(z.string()).min(1).max(6),
  pendingText: z.string().nullable(),
  interpretation: plannerInterpretation.nullable(),
  targets: z.array(z.object({ token: z.string(), id: uuid, type: z.enum(["group", "athlete"]), label: z.string() })),
  exercises: z.array(
    z.object({ token: z.string(), id: uuid, name: z.string(), category: z.string(), updatedAt: z.iso.datetime() }),
  ),
  phaseReviews: z.array(z.object({ date: isoDate, review: sessionPhaseReview })),
  draftIds: plannerCreatedSessions.nullable(),
});
export type PlannerProposalResponse = z.infer<typeof plannerProposalResponse>;
export const plannerProposalListQuery = z.object({ before: uuid.optional() }).strict();
export type PlannerProposalListQuery = z.infer<typeof plannerProposalListQuery>;
export const plannerProposalList = z.object({
  items: z
    .array(
      z.object({
        id: uuid,
        state: plannerProposalResponse.shape.state,
        period: plannerSelection.shape.period,
        createdAt: z.iso.datetime(),
        expiresAt: z.iso.datetime(),
      }),
    )
    .max(20),
  nextCursor: uuid.nullable(),
});
export type PlannerProposalList = z.infer<typeof plannerProposalList>;
const plannerUsageCounts = z.object({
  proposals: z.number().int().nonnegative(),
  audioSeconds: z.number().int().nonnegative(),
});
export const plannerUsageResponse = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  timeZone: z.string(),
  limit: plannerUsageCounts,
  used: plannerUsageCounts,
  reserved: plannerUsageCounts,
});
export type PlannerUsageResponse = z.infer<typeof plannerUsageResponse>;

export const createPlannerTranscriptionInput = z
  .object({
    id: uuid,
    requestedAt: z.iso.datetime(),
    audioProcessingAccepted: z.literal(true),
  })
  .strict();
export type CreatePlannerTranscriptionInput = z.infer<typeof createPlannerTranscriptionInput>;
export const plannerTranscriptionResponse = z.object({
  id: uuid,
  version: z.number().int().positive(),
  state: z.enum(["processing", "ready", "failed"]),
  text: z.string().min(1).max(12000).nullable(),
  audioSeconds: z.number().int().min(1).max(180),
  expiresAt: z.iso.datetime(),
});
export type PlannerTranscriptionResponse = z.infer<typeof plannerTranscriptionResponse>;
