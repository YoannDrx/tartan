import "server-only";
import { z } from "zod";
import {
  clockTime,
  exerciseCategory,
  exerciseClassification,
  exerciseFamily,
  plannerBrief,
  plannerComposedSession,
  plannerPeriod,
  plannerPrescription,
  plannerSlotSuggestion,
  sessionType,
  snapshotItem,
  trainingEquipment,
  trainingObjective,
  trainingPhaseKind,
  type PlannerComposition,
  type PlannerDefect,
  type PlannerFailureCode,
  type PlannerIntent,
  type PlannerMatchConfidence,
  type PlannerMatchGeneration,
  type PlannerStepName,
  type PlannerUnderstanding,
} from "@tartan/contracts";

// Le planificateur en quatre étapes : comprendre, retrouver, composer, contrôler. Ce fichier dit ce que chaque
// étape reçoit et rend. Le contexte est une projection autorisée, strictement limitée : le service le construit
// après contrôle des droits et du drapeau de l'espace. Aucun objet Prisma, aucun nom de personne, aucune donnée
// de santé n'y entre.

const token = z
  .string()
  .regex(/^[a-z]+_[0-9]+$/)
  .max(60);
const phase = z
  .object({ kind: trainingPhaseKind, week: z.number().int().positive(), weeks: z.number().int().positive() })
  .strict()
  .nullable();
export const PLANNER_LIBRARY_LIMIT = 5000;

export const plannerProviderContext = z
  .object({
    // Indices des clients d'avant le champ unique : le serveur comprend seul la demande.
    mode: z.enum(["format", "propose"]).optional(),
    brief: plannerBrief.optional(),
    startTime: clockTime.nullable().optional(),
    // Le jour choisi à l'écran par un client d'avant : retenu seulement si la demande n'en cite aucun.
    day: z.iso.date().nullable().optional(),
    // Choix du coach pendant cette demande (ancienne forme) : terme dit → fiche.
    resolvedExercises: z
      .array(z.object({ term: z.string().min(1).max(120), token }).strict())
      .max(50)
      .optional(),
    // Alias appris de l'espace : jamais ceux d'un autre espace.
    learnedAliases: z
      .array(z.object({ term: z.string().min(1).max(120), token }).strict())
      .max(2000)
      .optional(),
    period: plannerPeriod,
    today: z.iso.date(),
    timeZone: z.string().min(1).max(80),
    targets: z.array(z.object({ token, kind: z.enum(["group", "athlete"]), phase }).strict()).max(200),
    // Faux : aucun destinataire n'a été choisi à l'écran ; `targets` liste alors ceux que la demande peut citer.
    targetsChosen: z.boolean().optional(),
    // Toute la bibliothèque de l'espace : aucune coupe. Seules les étapes décident de ce qui part au modèle.
    exercises: z
      .array(
        z
          .object({
            token,
            name: z.string().min(1).max(200),
            category: exerciseCategory,
            aliases: z.array(z.string().min(1).max(200)).max(20),
            classification: exerciseClassification.strict().nullable().optional(),
            strengthLoadKind: snapshotItem.shape.strengthLoadKind,
            // Enrichissement pour l'étape « Composer » : lu sur le guide de la fiche.
            family: exerciseFamily.nullable().optional(),
            level: z.enum(["beginner", "intermediate", "advanced"]).nullable().optional(),
            unit: z.enum(["repetitions", "seconds", "meters", "contacts", "steps"]).nullable().optional(),
            sides: z.enum(["total", "each_side", "alternating_total"]).nullable().optional(),
            objective: z.string().max(600).nullable().optional(),
            // Fiche commune relue, ou copie d'une fiche relue : proposable. `own` : fiche du coach.
            approved: z.boolean().optional(),
            own: z.boolean().optional(),
            // Rang parmi les favoris et les listes du coach.
            preferred: z.number().int().min(0).nullable().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(PLANNER_LIBRARY_LIMIT),
    instructions: z.array(z.string().trim().min(1).max(12000)).min(1).max(11),
    phaseCalendar: z
      .array(z.object({ date: z.iso.date(), targetToken: token, phase }).strict())
      .max(5600)
      .optional(),
    // Profil de l'espace : disciplines, objectifs et matériel déclarés par le coach.
    space: z
      .object({
        disciplines: z.array(z.string().min(1).max(40)).max(20),
        objectives: z.array(trainingObjective).max(6),
        equipment: z.array(trainingEquipment).max(16),
      })
      .strict()
      .optional(),
    // Séances prévues autour de la période pour ces destinataires : champs structurés seulement. Jamais de titre,
    // de note, d'effort ressenti, de douleur, de blessure ni de séance réalisée : aucune donnée de santé ne part.
    neighbours: z
      .array(
        z
          .object({
            date: z.iso.date(),
            type: sessionType,
            targetTokens: z.array(token).max(200),
            exercises: z
              .array(
                z
                  .object({
                    exerciseToken: token.nullable(),
                    name: z.string().min(1).max(200).optional(),
                    sets: z.number().int().min(1).max(50).nullable(),
                    reps: z.number().int().min(1).max(500).nullable(),
                    distanceM: z.number().min(0).max(20000).nullable(),
                    durationS: z.number().int().min(0).max(14400).nullable(),
                    load: plannerPrescription.shape.load,
                  })
                  .strict(),
              )
              .max(30),
          })
          .strict(),
      )
      .max(40)
      .optional(),
    // Couverture des références de force : « all » ouvre le pourcentage du maximum, résolu par Tartan.
    strength: z
      .array(z.object({ exerciseToken: token, coverage: z.enum(["all", "some", "none"]) }).strict())
      .max(PLANNER_LIBRARY_LIMIT)
      .optional(),
    // « Ajuster » : la séance précédente, dans la forme que le modèle écrit, avec la date et les destinataires
    // que le serveur lui avait posés.
    previous: z
      .object({
        sessions: z
          .array(
            z
              .object({
                date: z.iso.date(),
                startTime: clockTime.nullable(),
                targetTokens: z.array(token).min(1).max(200),
                session: plannerComposedSession,
                movements: z
                  .array(
                    z
                      .object({
                        id: z.string().max(8),
                        said: z.string().max(120),
                        exerciseToken: z.string().max(60),
                        confidence: z.enum(["exact", "sure", "probable", "absent"]),
                        alternatives: z.array(z.string().max(60)).max(3),
                        suggestion: plannerSlotSuggestion.optional(),
                      })
                      .strict(),
                  )
                  .max(120),
              })
              .strict(),
          )
          .min(1)
          .max(14),
      })
      .strict()
      .optional(),
  })
  .strict();
export type PlannerProviderContext = z.infer<typeof plannerProviderContext>;

export type PlannerProviderFailure = "disabled" | PlannerFailureCode;
export class PlannerProviderError extends Error {
  constructor(
    readonly code: PlannerProviderFailure,
    // L'étape où la panne est survenue : elle se lit dans le message rendu au coach.
    readonly step: PlannerStepName | null = null,
  ) {
    super(`planner_${code}${step ? `_${step}` : ""}`);
    this.name = "PlannerProviderError";
  }
}

// ─── Ce que chaque étape donne au modèle ───────────────────────────────────────────────────────────────────────

type Day = { date: string; weekday: string };
/** Étape 1 : la demande, le calendrier et les destinataires possibles. Jamais la bibliothèque. */
export type PlannerUnderstandInput = {
  today: string;
  todayWeekday: string;
  calendar: Day[];
  relative: { hier: string; aujourdHui: string; demain: string; apresDemain: string };
  recipients: { token: string; kind: "group" | "athlete" }[];
  recipientsChosen: boolean;
  request: string;
  followUps: string[];
  // Vrai : `request` ajuste une séance déjà écrite.
  adjusting: boolean;
  hints: {
    intent: PlannerIntent | null;
    date: string | null;
    durationMin: number | null;
    level: "beginner" | "intermediate" | "advanced" | null;
    equipment: string[] | null;
  };
};
/** Étape 2 : les termes que les règles n'ont pas reconnus, et la bibliothèque réduite à cinq champs par fiche. */
export type PlannerMatchInput = {
  // `near` : les autres mouvements cités dans la même séance, dans l'ordre, pour comprendre une mention elliptique.
  movements: { id: string; said: string; prescription: string | null; near: string[] }[];
  library: { key: string; name: string; aliases: string[]; family: string | null; equipment: string[] | null }[];
};
export type PlannerComposeExercise = {
  token: string;
  name: string;
  family: string | null;
  level: string | null;
  unit: string | null;
  sides: string | null;
  loadKind: string | null;
  equipment: string[] | null;
  objective: string | null;
};
/** Étape 3 : la compréhension, les seules fiches utiles, et le contexte. */
export type PlannerComposeInput = {
  today: string;
  request: string;
  followUps: string[];
  understanding: {
    intent: PlannerIntent;
    sessions: {
      index: number;
      date: string;
      weekday: string;
      startTime: string | null;
      targetTokens: string[];
      structure: string | null;
      movements: {
        id: string;
        said: string;
        prescription: string | null;
        replaces: string | null;
        exerciseToken: string;
        confidence: PlannerMatchConfidence;
      }[];
      proposal: {
        objective: string;
        durationMin: number | null;
        level: string | null;
        equipment: string[];
        families: string[];
      } | null;
    }[];
    corrections: { said: string; kept: string }[];
  };
  exercises: PlannerComposeExercise[];
  // Emplacements à compléter : des mouvements cités sans fiche, à poser comme une fiche.
  slots: { token: string; said: string }[];
  // Jetons proposables pour la partie à composer.
  candidates: string[];
  percentAllowed: string[];
  space: PlannerProviderContext["space"] | null;
  neighbours: NonNullable<PlannerProviderContext["neighbours"]>;
  phases: { index: number; targetToken: string; phase: NonNullable<z.infer<typeof phase>> }[];
  previous: { sessions: z.infer<typeof plannerComposedSession>[] } | null;
  adjustment: string | null;
};
/** Réparation ciblée : la réponse fautive, telle quelle, et la liste précise de ses défauts. */
export type PlannerRepairInput = PlannerComposeInput & { previousAnswer: unknown; defects: PlannerDefect[] };

export type PlannerStepOptions = {
  // Le texte du modèle à mesure qu'il s'écrit.
  onDelta?: (text: string) => void;
  // Le délai de l'étape et celui de la demande entière.
  signal?: AbortSignal;
};
/**
 * Le prestataire : une fonction typée par étape, rien d'autre. Aucun contrôle ne vit ici : les règles de
 * `packages/domain` s'appliquent à ce qu'il rend, qu'il soit OpenAI ou simulé.
 */
export interface PlannerProvider {
  understand(input: PlannerUnderstandInput, options?: PlannerStepOptions): Promise<PlannerUnderstanding>;
  match(input: PlannerMatchInput, options?: PlannerStepOptions): Promise<PlannerMatchGeneration>;
  compose(input: PlannerComposeInput, options?: PlannerStepOptions): Promise<PlannerComposition>;
  repair(input: PlannerRepairInput, options?: PlannerStepOptions): Promise<PlannerComposition>;
}
