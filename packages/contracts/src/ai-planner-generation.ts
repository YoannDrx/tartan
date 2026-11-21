import { z } from "zod";
import {
  plannerItem,
  plannerInterpretation,
  plannerPlannedSet,
  plannerPrescription,
  plannerQuestion,
  plannerSession,
} from "./ai-planner";

// Le modèle écrit un seul arbre ordonné. Identifiants, date, destinataires et projection compatible
// appartiennent au serveur. Toutes les clés sont requises (sortie stricte) : une absence vaut null.
export const plannerGenerationPrescription = plannerPrescription.extend({
  setPlan: z
    .array(plannerPlannedSet)
    .min(1)
    .max(30)
    .nullable()
    .describe(
      "Séries détaillées quand elles diffèrent (pyramide, échauffement, charge qui change). Null quand toutes les séries sont identiques.",
    ),
});
const autonomous = z
  .object({
    exerciseToken: plannerItem.shape.exerciseToken,
    prescription: plannerGenerationPrescription,
    instruction: plannerItem.shape.instruction,
  })
  .strict()
  .nullable()
  .describe("Exercice fait à la place par les athlètes qui s'entraînent seuls, seulement si la consigne le demande.");
const exercise = z
  .object({
    kind: z.literal("exercise"),
    exerciseToken: plannerItem.shape.exerciseToken,
    prescription: plannerGenerationPrescription,
    instruction: plannerItem.shape.instruction,
    autonomous,
  })
  .strict();
const recovery = z.object({ kind: z.literal("recovery"), durationS: z.number().int().min(1).max(3600) }).strict();
const leaf = z.discriminatedUnion("kind", [exercise, recovery]);
const repeat = z
  .object({
    kind: z.literal("repeat"),
    name: z.string().trim().min(1).max(80),
    rounds: z.number().int().min(2).max(50),
    restBetweenRoundsS: z.number().int().min(0).max(3600),
    children: z.array(leaf).min(1).max(60),
  })
  .strict();
const innerNode = z.discriminatedUnion("kind", [exercise, recovery, repeat]);
const outerRepeat = repeat.extend({ children: z.array(innerNode).min(1).max(60) });
export const plannerGenerationNode = z.discriminatedUnion("kind", [exercise, recovery, outerRepeat]);
const generationBlocks = z
  .array(
    z
      .object({
        name: z.string().min(1).max(80),
        content: z.array(plannerGenerationNode).min(1).max(60),
      })
      .strict(),
  )
  .min(1)
  .max(12);
const generationQuestions = z
  .array(plannerQuestion.extend({ exerciseName: plannerQuestion.shape.exerciseName.unwrap() }))
  .max(10);

// « Mettre en forme » : le modèle date et adresse chaque séance d'après la consigne.
export const plannerGeneration = plannerInterpretation.extend({
  questions: generationQuestions,
  sessions: z.array(plannerSession.extend({ blocks: generationBlocks })).max(14),
});
// « Proposer » : une seule séance ; la date, l'heure et les destinataires viennent de la demande, posés par le serveur.
export const plannerProposeGeneration = plannerInterpretation.extend({
  questions: generationQuestions,
  sessions: z
    .array(
      z
        .object({
          title: plannerSession.shape.title,
          type: plannerSession.shape.type,
          durationMin: plannerSession.shape.durationMin,
          blocks: generationBlocks,
        })
        .strict(),
    )
    .max(1),
});
export type PlannerGeneration = z.infer<typeof plannerGeneration>;
export type PlannerProposeGeneration = z.infer<typeof plannerProposeGeneration>;
export type PlannerGenerationNode = z.infer<typeof plannerGenerationNode>;
export type PlannerGenerationPrescription = z.infer<typeof plannerGenerationPrescription>;
