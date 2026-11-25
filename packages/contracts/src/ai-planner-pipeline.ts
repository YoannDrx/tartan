import { z } from "zod";
import {
  plannerIntent,
  plannerEquipment,
  plannerItem,
  plannerMatchConfidence,
  plannerPlannedSet,
  plannerPrescription,
  plannerSession,
  plannerSlotSuggestion,
} from "./ai-planner";
import { exerciseFamily } from "./exercise-guide";
import { clockTime, isoDate } from "./session";

// Sorties structurées des étapes du planificateur (21 novembre 2026). Chaque schéma est strict : toutes les clés
// sont requises, une absence vaut null. Aucun identifiant de personne, aucune donnée de santé.

// ─── Étape 1, « Comprendre » : ce que le coach demande, sans la bibliothèque ───────────────────────────────────

export const plannerMovementId = z.string().regex(/^m[0-9]{1,3}$/);
export const plannerUnderstoodMovement = z
  .object({
    id: plannerMovementId.describe("m1, m2, m3… dans l'ordre où le coach les cite."),
    said: z
      .string()
      .min(1)
      .max(120)
      .describe("Le nom du mouvement, recopié mot pour mot de la demande, sans sa prescription."),
    prescription: z
      .string()
      .max(300)
      .nullable()
      .describe("Ce que le coach a dit pour ce mouvement (séries, répétitions, charge, repos), mot pour mot."),
    replaces: plannerMovementId
      .nullable()
      .describe("Seulement si ce mouvement est fait à la place d'un autre par les athlètes qui s'entraînent seuls."),
  })
  .strict();
export type PlannerUnderstoodMovement = z.infer<typeof plannerUnderstoodMovement>;

export const plannerUnderstoodProposal = z
  .object({
    objective: z.string().min(1).max(500).describe("Ce que le coach veut faire travailler, dans ses mots."),
    durationMin: z.number().int().min(5).max(300).nullable(),
    level: z.enum(["beginner", "intermediate", "advanced"]).nullable(),
    equipment: z
      .array(plannerEquipment)
      .max(16)
      .nullable()
      .describe("Le matériel dit par le coach ; « sans matériel » : [\"bodyweight\"] ; rien de dit : null."),
    families: z.array(exerciseFamily).max(9),
  })
  .strict();
export type PlannerUnderstoodProposal = z.infer<typeof plannerUnderstoodProposal>;

export const plannerUnderstoodSession = z
  .object({
    date: isoDate.nullable().describe("Une date du calendrier fourni, ou null si aucune ne se déduit."),
    dateSaid: z.string().max(120).nullable().describe("Les mots du coach pour cette date, ou null."),
    startTime: clockTime.nullable(),
    targetTokens: z.array(z.string().min(1).max(60)).max(200),
    movements: z.array(plannerUnderstoodMovement).max(60),
    structure: z
      .string()
      .max(800)
      .nullable()
      .describe("Circuit, superset, tours, récupérations : qui s'enchaîne avec qui, avec les identifiants m1, m2…"),
    proposal: plannerUnderstoodProposal.nullable().describe("La partie que le coach laisse composer, sinon null."),
  })
  .strict();
export type PlannerUnderstoodSession = z.infer<typeof plannerUnderstoodSession>;

export const plannerUnderstanding = z
  .object({
    // En tête : c'est la première chose que le coach lit, diffusée pendant qu'elle s'écrit.
    summary: z.string().min(1).max(600),
    offTopic: z.boolean().describe("Vrai si la demande ne décrit ni ne demande aucune séance d'entraînement."),
    intent: plannerIntent,
    sessions: z.array(plannerUnderstoodSession).max(14),
    corrections: z
      .array(z.object({ said: z.string().max(200), kept: z.string().max(200) }).strict())
      .max(10)
      .describe("Corrections orales résolues : ce qui a été dit d'abord, puis ce qui est retenu."),
  })
  .strict();
export type PlannerUnderstanding = z.infer<typeof plannerUnderstanding>;

// ─── Étape 2, « Retrouver » : un terme dit, une fiche ───────────────────────────────────────────────────────────

// Sortie du modèle pour les termes que les règles n'ont pas reconnus. `key` est la clé courte d'une fiche de la
// liste fournie (f1, f2…) ; le serveur la vérifie, une clé inconnue vaut `absent`.
export const plannerMatchGeneration = z
  .object({
    matches: z
      .array(
        z
          .object({
            id: plannerMovementId,
            confidence: z.enum(["sure", "probable", "absent"]),
            key: z.string().max(12).nullable(),
            others: z.array(z.string().max(12)).max(3),
            // Pour un terme absent seulement : de quoi préremplir la création de la fiche. Sinon null.
            suggestion: plannerSlotSuggestion.nullable(),
          })
          .strict(),
      )
      .max(60),
  })
  .strict();
export type PlannerMatchGeneration = z.infer<typeof plannerMatchGeneration>;

// Ajout du 22 novembre 2026. Le modèle ne dit plus sa confiance : pour chaque fiche qu'il propose, il dit sa
// relation au terme du coach, et le serveur décide par règle (`plannerMatchVerdict`, dans `packages/domain`).
// same_name : même mouvement, et le nom, un alias ou leur traduction directe le disent. same_known : même
// mouvement, mais seule la connaissance du modèle le dit. variant : même geste, à une précision près (matériel,
// agrès, position), ou terme plus général que la fiche. neighbor : un autre mouvement, simplement voisin.
export const plannerMatchRelation = z.enum(["same_name", "same_known", "variant", "neighbor"]);
export type PlannerMatchRelation = z.infer<typeof plannerMatchRelation>;
export const plannerMatchJudgement = z
  .object({
    matches: z
      .array(
        z
          .object({
            id: plannerMovementId,
            // Les fiches proposées, la meilleure d'abord : aucune si rien ne ressemble.
            candidates: z.array(z.object({ key: z.string().max(12), relation: plannerMatchRelation }).strict()).max(4),
            // De quoi créer la fiche quand aucune n'est ce mouvement ; sinon null.
            suggestion: plannerSlotSuggestion.nullable(),
          })
          .strict(),
      )
      .max(60),
  })
  .strict();
export type PlannerMatchJudgement = z.infer<typeof plannerMatchJudgement>;

// Ce que l'étape rend pour chaque mouvement cité, dans l'ordre.
export const plannerMatch = z
  .object({
    id: plannerMovementId,
    said: z.string().min(1).max(120),
    confidence: plannerMatchConfidence,
    // Jeton de la fiche retenue ; null si et seulement si `absent`.
    exerciseToken: z.string().max(60).nullable(),
    // Jusqu'à trois autres fiches possibles.
    alternatives: z.array(z.string().max(60)).max(3),
    source: z.enum(["name", "alias", "learned", "model", "none"]),
    // Terme absent : les valeurs proposées pour créer sa fiche.
    suggestion: plannerSlotSuggestion.optional(),
  })
  .strict();
export type PlannerMatch = z.infer<typeof plannerMatch>;

// ─── Étape 3, « Composer » : la séance, en un seul arbre ordonné par bloc ──────────────────────────────────────

export const plannerComposedPrescription = plannerPrescription.extend({
  setPlan: z
    .array(plannerPlannedSet)
    .min(1)
    .max(30)
    .nullable()
    .describe(
      "Séries détaillées quand elles diffèrent (pyramide, échauffement, charge qui change). Null quand toutes les séries sont identiques.",
    ),
});
const composedAutonomous = z
  .object({
    movementId: plannerMovementId.nullable(),
    exerciseToken: plannerItem.shape.exerciseToken,
    prescription: plannerComposedPrescription,
  })
  .strict()
  .nullable()
  .describe("Exercice fait à la place par les athlètes qui s'entraînent seuls, seulement si le coach le demande.");
const composedExercise = z
  .object({
    kind: z.literal("exercise"),
    movementId: plannerMovementId
      .nullable()
      .describe("L'identifiant du mouvement cité par le coach ; null pour un exercice que tu proposes."),
    exerciseToken: plannerItem.shape.exerciseToken,
    prescription: plannerComposedPrescription,
    reason: z
      .string()
      .max(300)
      .nullable()
      .describe("Pour un exercice proposé : en une phrase, pourquoi il sert l'objectif. Null pour un mouvement cité."),
    autonomous: composedAutonomous,
  })
  .strict();
const composedRecovery = z
  .object({ kind: z.literal("recovery"), durationS: z.number().int().min(1).max(3600) })
  .strict();
const composedLeaf = z.discriminatedUnion("kind", [composedExercise, composedRecovery]);
const composedRepeat = z
  .object({
    kind: z.literal("repeat"),
    name: z.string().trim().min(1).max(80),
    rounds: z.number().int().min(2).max(50),
    restBetweenRoundsS: z.number().int().min(0).max(3600),
    children: z.array(composedLeaf).min(1).max(60),
  })
  .strict();
const composedInner = z.discriminatedUnion("kind", [composedExercise, composedRecovery, composedRepeat]);
const composedOuterRepeat = composedRepeat.extend({ children: z.array(composedInner).min(1).max(60) });
export const plannerComposedNode = z.discriminatedUnion("kind", [
  composedExercise,
  composedRecovery,
  composedOuterRepeat,
]);
export type PlannerComposedNode = z.infer<typeof plannerComposedNode>;
export type PlannerComposedExercise = z.infer<typeof composedExercise>;

// La date, l'heure et les destinataires ne sont pas écrits par le modèle : le serveur les pose depuis la
// compréhension, par le rang de la séance. Aucune date ne peut donc être inventée à cette étape.
export const plannerComposedSession = z
  .object({
    index: z.number().int().min(0).max(13).describe("Le rang de la séance dans la compréhension."),
    title: plannerSession.shape.title,
    type: plannerSession.shape.type,
    durationMin: plannerSession.shape.durationMin,
    blocks: z
      .array(
        z
          .object({
            name: z.string().min(1).max(80),
            content: z.array(plannerComposedNode).min(1).max(60),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();
export type PlannerComposedSession = z.infer<typeof plannerComposedSession>;

export const plannerComposition = z
  .object({
    sessions: z.array(plannerComposedSession).max(14),
    assumptions: z.array(z.string().min(1).max(500)).max(5),
    suggestions: z.array(z.string().min(1).max(500)).max(5),
  })
  .strict();
export type PlannerComposition = z.infer<typeof plannerComposition>;

// ─── Étape 4, « Contrôler » : un défaut précis, rendu au modèle pour une réparation ciblée ─────────────────────

export const plannerDefectCode = z.enum([
  // Un mouvement cité par le coach manque dans la séance.
  "missing_movement",
  // Un exercice que le coach n'a pas dit, dans une partie qu'il a décrite.
  "added_exercise",
  // Les mouvements cités ne sont pas dans l'ordre de la demande.
  "order",
  // Une charge que le coach n'a pas dite, ou des kilos sur un exercice proposé.
  "invented_load",
  // Une séance de la compréhension sans séance composée, ou vide.
  "missing_session",
  // Un arbre qui ne s'exécute pas : niveaux, références, tours.
  "structure",
  // Des tours demandés absents, ou une pause placée là où elle ne s'exécute pas.
  "rounds",
]);
export type PlannerDefectCode = z.infer<typeof plannerDefectCode>;
export const plannerDefect = z
  .object({
    code: plannerDefectCode,
    // Rang de la séance concernée, ou null pour toute la réponse.
    session: z.number().int().min(0).max(13).nullable(),
    movementId: plannerMovementId.nullable(),
    // Ce qui ne va pas, dit précisément et en français, pour le modèle.
    detail: z.string().max(400),
  })
  .strict();
export type PlannerDefect = z.infer<typeof plannerDefect>;
