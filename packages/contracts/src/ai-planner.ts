import { z } from "zod";
import {
  clockTime,
  isoDate,
  uuid,
  sessionPhaseChoice,
  sessionPhaseReview,
  saveScheduledSessionInput,
  prescriptionSchema,
  sessionDraft,
  sessionDraftBlock,
  sessionDraftItem,
} from "./session";
import { exerciseCategory, sessionType } from "./enums";
import { exerciseMovement } from "./exercise-classification";
import { exerciseInput } from "./requests";
import { sequenceRef, sessionSequence } from "./session-sequence";
import { trainingEquipment } from "./training-profile";

// Schéma du prestataire : toutes les clés sont requises, les absences sont explicites.
// Aucun identifiant de personne, maximum individuel ou outil d’écriture dans ce contrat.
const nullableNumber = (min: number, max: number) => z.number().min(min).max(max).nullable();
const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();
export const plannerPrescription = z
  .object({
    sets: nullableInt(1, 50).describe(
      "Nombre de séries, ou nombre de passages pour une course ou un exercice chronométré.",
    ),
    reps: nullableInt(1, 500).describe(
      "Répétitions de mouvement par série. Null pour une course exprimée en passages × distance ou durée.",
    ),
    distanceM: nullableNumber(0, 20000).describe(
      "Distance en mètres de chaque passage ; le total est sets × distanceM.",
    ),
    durationS: nullableInt(0, 14400).describe(
      "Durée en secondes de chaque série ou passage, pas de la séance entière.",
    ),
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
    contacts: nullableInt(0, 2000).describe("Contacts au sol totaux sur cet exercice, toutes séries comprises."),
    notes: z.string().max(500).nullable(),
  })
  .strict();
export const plannerItem = z
  .object({
    // Jeton de la bibliothèque autorisée ; le service le traduit en exerciseId après validation.
    ref: sequenceRef.nullable().optional(),
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
            sequence: sessionSequence.nullable().optional(),
            // A V2 block may contain only explicit recovery; the domain checks its sequence.
            items: z.array(plannerItem).max(60),
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
    field: z
      .enum(["target", "date", "exercise", "unit", "rest", "load", "other"])
      .describe(
        "Information manquante : target = destinataire ; date = jour ou période, y compris une période trop longue ; exercise = fiche de bibliothèque inconnue ou ambiguë ; unit = sens d'un nombre sans unité (mètres, secondes, répétitions, par jambe, par haltère) ; rest = récupération absente, habituelle ou contradictoire ; load = charge absente, habituelle, contradictoire ou conversion demandée ; other = séries, répétitions ou nombre de séances, notamment plus de quatorze séances.",
      ),
    question: z.string().min(1).max(500),
    // Additif : citation exacte du mouvement non résolu ; jamais une création automatique.
    exerciseName: z.string().trim().min(1).max(120).nullable().optional(),
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
export const plannerProviderInterpretation = plannerInterpretation.extend({
  sessions: z
    .array(
      plannerSession.extend({
        blocks: z
          .array(
            plannerSession.shape.blocks.element.extend({
              sequence: sessionSequence.nullable(),
              items: z.array(plannerItem.extend({ ref: plannerItem.shape.ref.unwrap() })).max(60),
            }),
          )
          .min(1)
          .max(12),
      }),
    )
    .max(14),
  questions: z.array(plannerQuestion.extend({ exerciseName: plannerQuestion.shape.exerciseName.unwrap() })).max(10),
});

export type PlannerInterpretation = z.infer<typeof plannerInterpretation>;
export type PlannerPrescription = z.infer<typeof plannerPrescription>;

// Interprétation enrichie, gardée côté serveur : séries détaillées, remplacement en autonomie et points à vérifier.
// L'API la projette sur `plannerInterpretation`, strict, que les applications déjà installées savent lire ; le web
// reçoit le détail par les brouillons préparés.
export const plannerPlannedSet = z
  .object({
    reps: nullableInt(1, 500),
    load: plannerPrescription.shape.load,
    warmup: z.boolean(),
  })
  .strict();
export const plannerRichPrescription = plannerPrescription.extend({
  strides: prescriptionSchema.shape.strides,
  coneSpacingFt: prescriptionSchema.shape.cone_spacing_ft,
  setPlan: z.array(plannerPlannedSet).min(1).max(30).nullable().optional(),
});
export const plannerWarningField = z.enum(["exercise", "rest", "load", "rounds", "date", "other"]);
export const plannerWarningCode = z.enum([
  "approximate_exercise",
  "rest_not_executed",
  "rounds_not_stated",
  "rounds_missing",
  "habit_load",
  "habit_rest",
  // Additifs (21 novembre 2026), servis aux seuls clients qui déclarent `accepts: ["checks"]`.
  // Charge ambiguë ou sans unité : laissée vide, jamais inventée.
  "load_unclear",
  // Nombre sans unité : rangé selon l'unité de comptage de la fiche (secondes, mètres, répétitions).
  "unit_assumed",
  // Mouvement cité dont la prescription n'a pas pu être écrite : la fiche est posée, à compléter.
  "to_complete",
]);
/** Les codes que lisent les applications déjà installées. Les autres ne partent que vers un client qui les déclare. */
export const PLANNER_LEGACY_WARNING_CODES: readonly string[] = [
  "approximate_exercise",
  "rest_not_executed",
  "rounds_not_stated",
  "rounds_missing",
  "habit_load",
  "habit_rest",
];
// Un point « À vérifier » : la proposition reste utilisable, le coach relit ce champ.
export const plannerWarning = z
  .object({
    code: plannerWarningCode,
    field: plannerWarningField,
    // Position de l'exercice concerné dans la séance, ou null pour la séance entière.
    block: z.number().int().min(0).max(11).nullable(),
    item: z.number().int().min(0).max(59).nullable(),
    detail: z.string().max(200).nullable(),
  })
  .strict();
export type PlannerWarning = z.infer<typeof plannerWarning>;
// Confiance du rapprochement entre un terme dit et une fiche. `absent` : aucune fiche, un emplacement à compléter.
export const plannerMatchConfidence = z.enum(["exact", "sure", "probable", "absent"]);
export type PlannerMatchConfidence = z.infer<typeof plannerMatchConfidence>;
// Un emplacement à compléter occupe la place d'un exercice : son jeton commence par ce préfixe et ne désigne
// aucune fiche. Dans les brouillons préparés, son `exerciseId` est cet identifiant réservé, jamais une fiche.
export const PLANNER_SLOT_PREFIX = "slot_";
export const PLANNER_SLOT_EXERCISE_ID = "00000000-0000-4000-8000-0000000051a7";
// De quoi préremplir la création rapide d'une fiche absente : un nom propre (le terme du coach nettoyé, sans
// prescription), et la catégorie, la famille de mouvement et le type de charge les plus probables. Ce sont des
// valeurs par défaut, que le coach modifie.
export const plannerSlotSuggestion = z
  .object({
    name: z.string().trim().min(1).max(120),
    category: exerciseCategory,
    movement: exerciseMovement,
    loadKind: z.enum(["external_total", "added_weight", "assistance", "bodyweight"]),
  })
  .strict();
export type PlannerSlotSuggestion = z.infer<typeof plannerSlotSuggestion>;
export const plannerRichItem = plannerItem.extend({
  // Additifs, gardés côté serveur. `said` : le terme exact du coach ; absent pour un exercice proposé.
  origin: z.enum(["said", "proposed"]).optional(),
  // Le mouvement de la compréhension que cet exercice exécute (m1, m2…).
  movementId: z.string().max(8).optional(),
  said: z.string().min(1).max(120).optional(),
  confidence: plannerMatchConfidence.optional(),
  // Les autres fiches possibles d'un rapprochement `probable` ou d'un emplacement, en jetons.
  alternatives: z.array(plannerItem.shape.exerciseToken).max(3).optional(),
  // Emplacement à compléter seulement : de quoi préremplir la création de la fiche.
  suggestion: plannerSlotSuggestion.optional(),
  prescription: plannerRichPrescription,
  autonomous: z
    .object({ exerciseToken: plannerItem.shape.exerciseToken, prescription: plannerRichPrescription })
    .strict()
    .nullable()
    .optional(),
});
export const plannerRichSession = plannerSession.extend({
  blocks: z
    .array(plannerSession.shape.blocks.element.extend({ items: z.array(plannerRichItem).max(60) }))
    .min(1)
    .max(12),
  warnings: z.array(plannerWarning).max(30).optional(),
});
export const plannerIntent = z.enum(["described", "objective", "mixed"]);
export type PlannerIntent = z.infer<typeof plannerIntent>;
export const plannerRichInterpretation = plannerInterpretation.extend({
  sessions: z.array(plannerRichSession).max(14),
  // Additif : ce que l'étape « Comprendre » a lu, pour l'écran. Jetons de destinataires, jamais de nom.
  understanding: z
    .object({
      intent: plannerIntent,
      summary: z.string().max(2000),
      movements: z
        .array(
          z.object({
            said: z.string().max(120),
            prescription: z.string().max(300).nullable(),
            confidence: plannerMatchConfidence,
            exerciseToken: z.string().max(60).nullable(),
          }),
        )
        .max(120),
      corrections: z.array(z.object({ said: z.string().max(200), kept: z.string().max(200) })).max(10),
    })
    .optional(),
});
export type PlannerRichInterpretation = z.infer<typeof plannerRichInterpretation>;
export type PlannerRichSession = z.infer<typeof plannerRichSession>;
export type PlannerRichPrescription = z.infer<typeof plannerRichPrescription>;

// La séance relue à l'écran : ce que le coach confirme, et la base de tout ce qu'il demande ensuite.
export const plannerReviewedDraft = saveScheduledSessionInput
  .omit({ id: true, expectedVersion: true })
  .extend({ publishAt: z.null() })
  .strict();
export type PlannerReviewedDraft = z.infer<typeof plannerReviewedDraft>;
// Additif (22 novembre 2026) : les séances telles qu'elles sont à l'écran. Envoyées avec un ajustement ou avec le
// choix d'une fiche, elles deviennent la base de la suite : aucune retouche faite à la main n'est perdue. Sans
// elles, le serveur repart de la séance qu'il avait gardée, comme avant.
const plannerScreenSessions = z.array(plannerReviewedDraft).min(1).max(14).optional();

export const resolvePlannerExerciseInput = z
  .object({
    operationId: uuid,
    expectedVersion: z.number().int().positive(),
    // Un emplacement à compléter (`slot_N`), une question nommée de l'ancienne forme, ou, depuis le 22 novembre
    // 2026, la référence d'un exercice des brouillons préparés dont la fiche est « À vérifier » : le coach la
    // valide ou en choisit une autre, et le terme est retenu.
    questionId: z.string().min(1).max(60),
    requestedName: z.string().trim().min(1).max(120),
    sessions: plannerScreenSessions,
    choice: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("existing"), exerciseId: uuid }).strict(),
      z
        .object({
          kind: z.literal("create"),
          // Depuis le 21 novembre 2026, tout champ est facultatif : pour un emplacement à compléter, ce qui manque
          // vient des valeurs proposées (`suggestion`), le nom venant sinon du terme dit. Le coach modifie ce
          // qu'il veut, nom compris. La case « relu » n'est plus exigée par le serveur ; les clients d'avant
          // l'envoient encore.
          exercise: exerciseInput.omit({ id: true, media: true }).partial().strict(),
          reviewed: z.literal(true).optional(),
        })
        .strict(),
      // Additif : retirer un emplacement à compléter de la séance. Refusé pour une question de l'ancienne forme.
      z.object({ kind: z.literal("remove") }).strict(),
    ]),
  })
  .strict();
export type ResolvePlannerExerciseInput = z.infer<typeof resolvePlannerExerciseInput>;

// Quatre semaines au plus depuis le 21 novembre 2026 (sept jours avant) : le coach cite sa date dans la consigne,
// la période n'est plus que la fenêtre où cette date peut tomber.
export const PLANNER_MAX_PERIOD_DAYS = 28;
export const plannerPeriod = z
  .object({ from: isoDate, to: isoDate })
  .strict()
  .refine(
    (p) =>
      p.from <= p.to &&
      Date.parse(`${p.to}T00:00:00Z`) - Date.parse(`${p.from}T00:00:00Z`) <= (PLANNER_MAX_PERIOD_DAYS - 1) * 86400000,
  );
// Ce que le client sait afficher. `slots` : les emplacements à compléter dans la séance (sans lui, un exercice
// absent revient sous l'ancienne forme, une question nommée). `checks` : les nouveaux points « À vérifier ».
// Un client qui ne déclare rien reçoit exactement les formes d'avant.
export const plannerCapability = z.enum(["slots", "checks"]);
export type PlannerCapability = z.infer<typeof plannerCapability>;

export const plannerBrief = z
  .object({
    objective: z.string().trim().min(1).max(1000),
    date: isoDate,
    durationMin: z.number().int().min(5).max(180),
    level: z.enum(["beginner", "intermediate", "advanced"]),
    equipment: z.array(z.string().trim().min(1).max(80)).max(20),
  })
  .strict();
export type PlannerBrief = z.infer<typeof plannerBrief>;

// Additif (22 novembre 2026) : les précisions facultatives du champ unique. Chacune est un indice, retenu
// seulement quand la demande ne dit rien elle-même. Aucune n'est requise ; elles remplacent le `brief` complet
// des clients d'avant, qui reste accepté.
export const plannerEquipment = z.enum([...trainingEquipment.options, "jump_rope"]);
export const plannerRequestHints = z
  .object({
    durationMin: z.number().int().min(5).max(300).optional(),
    level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    equipment: z.array(plannerEquipment).max(plannerEquipment.options.length).optional(),
  })
  .strict();
export type PlannerRequestHintsInput = z.infer<typeof plannerRequestHints>;

export const plannerSelection = z
  .object({
    // Depuis le 21 novembre 2026, le serveur comprend seul la demande : `mode` et `brief` ne sont plus que des
    // indices, envoyés par les clients d'avant.
    mode: z.enum(["format", "propose"]).optional(),
    brief: plannerBrief.optional(),
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
      .max(PLANNER_MAX_PERIOD_DAYS)
      .optional(),
  })
  .strict()
  .refine(
    (s) =>
      (s.mode !== "propose" || (Boolean(s.brief) && s.brief!.date >= s.period.from && s.brief!.date <= s.period.to)) &&
      // Aucun destinataire choisi n'est plus une saisie invalide : le planificateur lit ceux que la consigne
      // cite parmi les groupes et athlètes du coach, ou pose la question.
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
    // Additif, mode « Proposer » : l'heure demandée, posée par le serveur sur la séance (jamais choisie par l'IA).
    startTime: clockTime.nullable().optional(),
    // Additif : les formes nouvelles que ce client sait afficher (voir `plannerCapability`).
    accepts: z.array(plannerCapability).max(4).optional(),
    // Additif : durée, niveau, matériel, quand le coach les précise à l'écran.
    hints: plannerRequestHints.optional(),
  })
  .strict();
export type CreatePlannerProposalInput = z.infer<typeof createPlannerProposalInput>;
export const decidePlannerAdjustmentInput = z
  .object({ expectedVersion: z.number().int().positive(), apply: z.boolean() })
  .strict();
export const adjustmentReviewRequest = z
  .object({
    keep: z
      .array(z.object({ session: z.number().int().min(0).max(13), block: z.number().int().min(0).max(11) }))
      .max(168),
  })
  .strict();
export const clarifyPlannerProposalInput = z
  .object({
    operationId: uuid,
    expectedVersion: z.number().int().positive(),
    text: z.string().trim().min(1).max(12000),
    reviewed: z.literal(true),
    // « Ajuster » seulement : la séance à l'écran, que l'ajustement modifie.
    adjustmentReview: adjustmentReviewRequest.optional(),
    sessions: plannerScreenSessions,
  })
  .strict();
export type ClarifyPlannerProposalInput = z.infer<typeof clarifyPlannerProposalInput>;

export const confirmPlannerProposalInput = z
  .object({
    expectedVersion: z.number().int().positive(),
    confirmed: z.literal(true),
    selectedIndices: z.array(z.number().int().min(0).max(13)).min(1).max(14).optional(),
    sessions: z.array(plannerReviewedDraft).min(1).max(14),
  })
  .strict();
export type ConfirmPlannerProposalInput = z.infer<typeof confirmPlannerProposalInput>;

export const savePlannerReviewInput = confirmPlannerProposalInput.omit({ confirmed: true, selectedIndices: true });
export const removePlannerProposalQuery = z.object({ expectedVersion: z.coerce.number().int().positive() }).strict();
export const preparePlannerDraftsInput = z.object({ expectedVersion: z.number().int().positive() }).strict();
const plannerCreatedSessions = z
  .array(z.object({ id: uuid, version: z.number().int().positive() }))
  .min(1)
  .max(14);
export const plannerConfirmationResult = z.object({
  sessions: plannerCreatedSessions,
  partial: z.boolean().optional(),
});
// Réponse de relecture seulement : l'expansion locale des noms peut dépasser
// les limites d'écriture. Le coach corrige le texte entier, jamais tronqué.
// Confirmation et aperçu de charges conservent plannerReviewedDraft strict.
const preparedText = z.string().max(24000);
export const plannerPreparedDraft = plannerReviewedDraft.extend({
  draft: sessionDraft.extend({
    title: preparedText,
    blocks: z
      .array(
        sessionDraftBlock.extend({
          name: preparedText,
          items: z
            .array(
              sessionDraftItem.extend({
                prescription: prescriptionSchema.extend({ notes: preparedText.optional() }),
              }),
            )
            .max(60),
        }),
      )
      .min(1)
      .max(12),
  }),
});
// Un emplacement à compléter : le terme dit par le coach, sa place dans la séance, les fiches possibles.
export const plannerSlotView = z.object({
  id: z.string().min(1).max(60),
  said: z.string().min(1).max(120),
  // Rang de la séance, et référence de l'exercice dans le brouillon préparé.
  session: z.number().int().min(0).max(13),
  itemRef: z.string().min(1).max(120),
  candidates: z.array(z.object({ exerciseId: uuid, name: z.string() })).max(3),
  // De quoi préremplir la création rapide de la fiche, quand l'étape « Retrouver » a pu le proposer.
  suggestion: plannerSlotSuggestion.optional(),
});
export type PlannerSlotView = z.infer<typeof plannerSlotView>;
export const plannerDraftsResponse = z.object({
  proposalId: uuid,
  version: z.number().int().positive(),
  sessions: z.array(plannerPreparedDraft).min(1).max(14),
  // Additif, clients `slots` seulement : les emplacements à compléter. L'exercice du brouillon porte alors
  // `PLANNER_SLOT_EXERCISE_ID` à la place d'une fiche, avec la prescription dite par le coach.
  slots: z.array(plannerSlotView).max(60).optional(),
  // Additif : les points « À vérifier » de chaque séance, rattachés à l'exercice du brouillon quand il y en a un.
  warnings: z
    .array(
      z.array(
        z.object({
          code: plannerWarningCode,
          field: plannerWarningField,
          itemRef: z.string().nullable(),
          detail: z.string().nullable(),
          // Additif : les autres fiches possibles d'un rapprochement incertain.
          alternatives: z
            .array(z.object({ exerciseId: uuid, name: z.string() }))
            .max(3)
            .optional(),
          // Additif : le terme que le coach a dit pour cet exercice, quand le point porte sur sa fiche.
          said: z.string().max(120).optional(),
        }),
      ),
    )
    .optional(),
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
// Pourquoi une génération a échoué : chaque cause dit au coach quoi faire. Aucune n'est décomptée du quota.
export const plannerFailureCode = z.enum([
  "configuration",
  "saturated",
  "unavailable",
  "timeout",
  "refused",
  "incomplete",
  "invalid_output",
]);
export type PlannerFailureCode = z.infer<typeof plannerFailureCode>;
// Les quatre étapes du serveur ; `repair` est la réparation ciblée de la quatrième.
export const plannerStepName = z.enum(["understand", "match", "compose", "repair"]);
export type PlannerStepName = z.infer<typeof plannerStepName>;
// Ce que le planificateur a compris, noms déjà résolus pour l'écran (« Ce que j'ai compris »).
export const plannerUnderstandingView = z.object({
  intent: plannerIntent,
  summary: z.string().max(4000),
  // Chaque mouvement cité, dans l'ordre : le terme dit, sa prescription telle que dite, et la fiche retrouvée.
  movements: z
    .array(
      z.object({
        said: z.string().max(120),
        prescription: z.string().max(300).nullable(),
        confidence: plannerMatchConfidence,
        exercise: z.object({ exerciseId: uuid, name: z.string() }).nullable(),
      }),
    )
    .max(120),
  corrections: z.array(z.object({ said: z.string().max(200), kept: z.string().max(200) })).max(10),
});
export type PlannerUnderstandingView = z.infer<typeof plannerUnderstandingView>;
export const duplicatePlannerProposalInput = z
  .object({ id: uuid, expectedVersion: z.number().int().positive() })
  .strict();
const plannerActions = z.array(z.enum(["progress", "answer", "edit", "retry", "sessions", "duplicate", "remove"]));
export const plannerProposalResponse = z.object({
  actions: plannerActions.optional(),
  // Additif : la cause du dernier échec, lisible après un rechargement. Les anciens clients l'ignorent.
  failure: z
    .object({ code: plannerFailureCode, message: z.string(), step: plannerStepName.nullable().optional() })
    .nullable()
    .optional(),
  // Additif : ce que le planificateur a compris de la demande.
  understanding: plannerUnderstandingView.nullable().optional(),
  // Additif, clients `slots` seulement : les emplacements encore à compléter avant de créer le brouillon.
  slots: z
    .array(plannerSlotView.omit({ itemRef: true }))
    .max(60)
    .optional(),
  id: uuid,
  version: z.number().int().positive(),
  state: z.enum(["processing", "clarification", "proposal", "failed", "committed"]),
  clarificationCount: z.number().int().min(0).max(5),
  // Additif : les ajustements d'une proposition ont leur propre compteur, distinct des précisions.
  adjustmentCount: z.number().int().min(0).max(5).optional(),
  expiresAt: z.iso.datetime(),
  selection: plannerSelection,
  messages: z.array(z.string()).min(1).max(6),
  pendingText: z.string().nullable(),
  interpretation: plannerInterpretation.nullable(),
  targets: z.array(z.object({ token: z.string(), id: uuid, type: z.enum(["group", "athlete"]), label: z.string() })),
  exercises: z.array(
    z.object({ token: z.string(), id: uuid, name: z.string(), category: z.string(), updatedAt: z.iso.datetime() }),
  ),
  exerciseResolutions: z.array(z.object({ questionId: z.string(), exerciseId: uuid, name: z.string() })).optional(),
  phaseReviews: z.array(z.object({ date: isoDate, review: sessionPhaseReview })),
  calendar: z
    .array(
      z.object({
        id: uuid,
        date: isoDate,
        title: z.string(),
        startTime: clockTime.nullable(),
        durationMin: z.number().int().positive().nullish(),
      }),
    )
    .optional(),
  availableEquipment: z.array(z.string()).optional(),
  adjustmentPreview: z.array(z.object({ before: z.array(z.string()), after: z.array(z.string()) })).optional(),
  createdSessionIndices: z.array(z.number().int().nonnegative()).optional(),
  linkedSessions: z
    .array(
      z.discriminatedUnion("state", [
        z.object({ id: uuid, state: z.literal("unavailable") }),
        z.object({
          id: uuid,
          state: z.enum(["published", "draft"]),
          date: isoDate,
          title: z.string(),
          version: z.number().int().positive(),
        }),
      ]),
    )
    .optional(),
  draftIds: plannerCreatedSessions.nullable(),
});
export type PlannerProposalResponse = z.infer<typeof plannerProposalResponse>;

// Réponse diffusée (`Accept: text/event-stream`) : un événement par étape du serveur. `understanding` porte le
// résumé « Ce que j'ai compris » à mesure qu'il s'écrit ; `matching` les fiches retrouvées ; `composing` le plan
// de la séance pendant qu'elle s'écrit ; `checking` les contrôles et le nombre de réparations ciblées ; puis
// `result`, ou `error`. Le JSON d'une seule pièce reste servi aux clients qui ne lisent pas le flux.
export const plannerStreamStage = z.enum(["understanding", "matching", "composing", "checking"]);
export type PlannerStreamStage = z.infer<typeof plannerStreamStage>;
export const plannerStreamPlanLine = z.object({ kind: z.enum(["block", "exercise"]), label: z.string().max(200) });
export type PlannerStreamPlanLine = z.infer<typeof plannerStreamPlanLine>;
export const plannerStreamMatch = z.object({
  said: z.string().max(120),
  confidence: plannerMatchConfidence,
  // Le nom de la fiche retrouvée ; null pour un emplacement à compléter.
  name: z.string().max(200).nullable(),
});
export type PlannerStreamMatch = z.infer<typeof plannerStreamMatch>;
export const plannerStreamEvent = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("understanding"),
    // `summary` grandit pendant que le modèle l'écrit ; `done` quand la compréhension est complète.
    data: z.object({ summary: z.string().max(4000).nullable(), done: z.boolean() }),
  }),
  z.object({
    event: z.literal("matching"),
    data: z.object({ movements: z.array(plannerStreamMatch).max(120), done: z.boolean() }),
  }),
  z.object({ event: z.literal("composing"), data: z.object({ lines: z.array(plannerStreamPlanLine).max(200) }) }),
  z.object({
    event: z.literal("checking"),
    // Nombre de réparations ciblées lancées (deux au plus).
    data: z.object({ repairs: z.number().int().min(0).max(2), done: z.boolean() }),
  }),
  z.object({ event: z.literal("result"), data: plannerProposalResponse }),
  z.object({
    event: z.literal("error"),
    // `step` : l'étape où la panne est survenue, quand elle est connue.
    data: z.object({
      status: z.number().int(),
      code: z.string(),
      message: z.string(),
      step: plannerStepName.nullable().optional(),
    }),
  }),
]);
export type PlannerStreamEvent = z.infer<typeof plannerStreamEvent>;
// Les termes appris de l'espace : ce qu'un coach a dit, et la fiche qu'il a choisie pour ce terme.
export const plannerAliasList = z.object({
  aliases: z
    .array(
      z.object({
        id: uuid,
        said: z.string(),
        exerciseId: uuid,
        exerciseName: z.string(),
        updatedAt: z.iso.datetime(),
      }),
    )
    .max(2000),
});
export type PlannerAliasList = z.infer<typeof plannerAliasList>;
export const plannerAliasRemoved = z.object({ removed: z.literal(true) });
export const plannerProposalListQuery = z
  .object({ before: uuid.optional(), filter: z.enum(["all", "pending", "created"]).optional() })
  .strict();
export type PlannerProposalListQuery = z.infer<typeof plannerProposalListQuery>;
export const plannerProposalList = z.object({
  items: z
    .array(
      z.object({
        id: uuid,
        state: plannerProposalResponse.shape.state,
        actions: plannerActions.optional(),
        version: z.number().int().positive().optional(),
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
  unlimited: z.boolean().optional(),
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
