import { exerciseClassification } from "./exercise-classification";
import { z } from "zod";
import {
  absenceReason,
  attendanceStatus,
  bodyArea,
  bodySide,
  commentEntity,
  consentKind,
  devicePlatform,
  exerciseCategory,
  injuryStatus,
  invitationKind,
  invitationRole,
  jumpPhase,
  jumpResult,
  logStatus,
  reportReason,
  sessionType,
  sessionVariant,
  strengthTestKind,
  takeoffFoot,
} from "./enums";
import { isoDate, prescriptionSchema, uuid } from "./session";
import { trainingProfileSchema } from "./training-profile";

const trimmed = (max: number) => z.string().trim().max(max);
const required = (max: number, message: string) => z.string().trim().min(1, message).max(max);

export const profileInput = z.object({
  firstName: required(60, "Indique ton prénom"),
  lastName: required(80, "Indique ton nom"),
  birthDate: isoDate.nullable().optional(),
  units: z.enum(["kg", "lb"]).optional(),
  locale: z.enum(["fr", "en"]).optional(),
  // Seules les photos envoyées dans le stockage de Tartan : pas de pixel espion sur une adresse tierce.
  avatarUrl: z
    .url()
    .refine((url) => /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url))
    .nullable()
    .optional(),
});
export type ProfileInput = z.infer<typeof profileInput>;

export const calendarView = z.enum(["list", "month", "week"]);
export type CalendarView = z.infer<typeof calendarView>;

// Écriture partielle : un champ absent ne change rien. La date permet de rejouer un choix fait hors ligne.
export const preferencesInput = z.object({
  aiConsent: z.boolean().optional(),
  calendarView: calendarView.optional(),
  calendarViewUpdatedAt: z.string().datetime().optional(),
  notifications: z
    .object({
      sessions: z.boolean().optional(),
      feedback: z.boolean().optional(),
      group: z.boolean().optional(),
      product: z.boolean().optional(),
    })
    .optional(),
  email: z.object({ digest: z.boolean().optional(), notifications: z.boolean().optional() }).optional(),
});
export type PreferencesInput = z.infer<typeof preferencesInput>;

export const createOrganizationInput = z.object({
  name: required(120, "Donne un nom à ton espace"),
  type: z.enum(["club", "independent"]),
  disciplines: trainingProfileSchema.shape.disciplines.default([]),
  trainingObjectives: trainingProfileSchema.shape.trainingObjectives.default([]),
  availableEquipment: trainingProfileSchema.shape.availableEquipment.default([]),
  firstGroupName: required(80, "Donne un nom à ton premier groupe"),
  firstGroupGoal: trimmed(280).nullable().optional(),
  referralCode: z.string().trim().max(40).optional(),
  birthDate: isoDate.optional(),
});
export type CreateOrganizationInput = z.input<typeof createOrganizationInput>;

export const groupInput = z.object({
  id: uuid.optional(),
  name: required(80, "Donne un nom au groupe"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
  level: trimmed(60).nullable().optional(),
  goal: trimmed(280).nullable().optional(),
});
export type GroupInput = z.infer<typeof groupInput>;

export const createInvitationInput = z
  .object({
    kind: invitationKind,
    role: invitationRole.default("athlete"),
    groupIds: z.array(uuid).max(20).default([]),
    email: z.email("Adresse e-mail invalide").optional(),
    phone: z.string().trim().min(6).max(24).optional(),
    athleteId: uuid.optional(),
    expiresInDays: z.number().int().min(1).max(30).optional(),
  })
  .refine((v) => v.kind !== "personal_email" || Boolean(v.email), {
    message: "Indique l'adresse e-mail à inviter",
    path: ["email"],
  })
  .refine((v) => v.kind !== "personal_sms" || Boolean(v.phone), {
    message: "Indique le numéro à inviter",
    path: ["phone"],
  });
export type CreateInvitationInput = z.input<typeof createInvitationInput>;

export const acceptInvitationInput = z.object({
  firstName: required(60, "Indique ton prénom"),
  lastName: required(80, "Indique ton nom"),
  birthDate: isoDate.nullable(),
  guardianEmail: z.email("Adresse e-mail du parent invalide").optional(),
  consents: z.object({
    terms: z.boolean(),
    health: z.boolean(),
    video: z.boolean(),
  }),
  referralCode: z.string().trim().max(40).optional(),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationInput>;

export const consentInput = z.object({
  kind: consentKind,
  granted: z.boolean(),
});

const birthDateInput = isoDate.refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date <= new Date();
}, "Indique une date de naissance valide");
export const confirmAgeInput = z.object({ birthDate: birthDateInput });
export const appleAuthorizationInput = z.object({ code: z.string().min(1).max(2048) });
export const adminSpaceFeaturesInput = z
  .object({
    organizationId: uuid,
    progressionEnabled: z.boolean(),
    phasesEnabled: z.boolean(),
    aiPlannerEnabled: z.boolean(),
  })
  .strict();

export const correctBirthDateInput = z.object({
  userId: uuid,
  birthDate: birthDateInput,
  reason: z.enum(["verified_support_request", "migration_error"]),
});

export const athleteConsentInput = z.object({
  kind: z.enum(["health", "video"]),
  granted: z.boolean(),
});

export const parentalConsentInput = z.object({
  token: z.string().min(16),
  decision: z.enum(["granted", "refused"]),
  scope: z.object({ health: z.boolean(), video: z.boolean() }),
});

export const athleteInput = z.object({
  id: uuid.optional(),
  firstName: required(60, "Indique le prénom"),
  lastName: required(80, "Indique le nom"),
  birthDate: isoDate.nullable().optional(),
  disciplines: z.array(z.string().max(40)).max(12).default([]),
  level: trimmed(60).nullable().optional(),
  takeoffFoot: takeoffFoot.nullable().optional(),
  approachSteps: z.number().int().min(1).max(40).nullable().optional(),
  goals: trimmed(2000).nullable().optional(),
  particularities: trimmed(2000).nullable().optional(),
  groupIds: z.array(uuid).max(20).default([]),
});
export type AthleteInput = z.input<typeof athleteInput>;

export const coachNoteInput = z.object({
  athleteId: uuid,
  body: required(4000, "La note est vide"),
});

export const strengthTestInput = z.object({
  athleteId: uuid,
  exerciseKey: required(60, "Choisis l'exercice testé"),
  exerciseId: uuid.optional(),
  selectAsReference: z.boolean().optional(),
  value: z.number().min(0.01, "Indique une charge").max(1000).multipleOf(0.01),
  kind: strengthTestKind,
  date: isoDate.refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }),
});
export type StrengthTestInput = z.infer<typeof strengthTestInput>;

export { performanceInput } from "./performance";

export const injuryInput = z.object({
  id: uuid.optional(),
  athleteId: uuid,
  bodyArea,
  side: bodySide,
  description: trimmed(2000).nullable().optional(),
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
  status: injuryStatus,
  restrictions: trimmed(2000).nullable().optional(),
});
export type InjuryInput = z.infer<typeof injuryInput>;

export const competitionInput = z.object({
  id: uuid.optional(),
  name: required(120, "Indique le nom de la compétition"),
  date: isoDate,
  location: trimmed(120).nullable().optional(),
  level: trimmed(60).nullable().optional(),
  athleteIds: z.array(uuid).max(200).default([]),
});

export const exerciseMediaInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("youtube"),
    url: z.string().trim().min(1, "Colle un lien YouTube"),
    customTitle: trimmed(120).nullable().optional(),
    startS: z.number().int().min(0).nullable().optional(),
    endS: z.number().int().min(0).nullable().optional(),
  }),
  z.object({
    kind: z.literal("instagram"),
    url: z.string().trim().min(1, "Colle un lien Instagram"),
    customTitle: trimmed(120).nullable().optional(),
  }),
  z.object({
    kind: z.literal("upload"),
    videoUploadId: z.string().min(1),
    customTitle: trimmed(120).nullable().optional(),
  }),
]);

export const exerciseInput = z.object({
  // Omitted by older apps: preserve the existing aliases on update.
  aliases: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  classification: exerciseClassification.nullable().optional(),
  id: uuid.optional(),
  name: required(120, "Donne un nom à l'exercice"),
  category: exerciseCategory,
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
  cues: z.array(z.string().trim().min(1).max(120)).max(5).default([]),
  defaultPrescription: prescriptionSchema.default({}),
  strengthLoadKind: z.enum(["external_total", "added_weight", "assistance", "bodyweight"]).nullable().optional(),
  loadStepKg: z.number().min(0.01).max(100).multipleOf(0.01).optional(),
  media: exerciseMediaInput.nullable().optional(),
});
export type ExerciseInput = z.input<typeof exerciseInput>;

export const painInput = z.object({
  bodyArea,
  side: bodySide,
  intensity: z.number().int().min(1).max(10),
});
export type PainInput = z.infer<typeof painInput>;

export const setLogInput = z.object({
  itemRef: z.string(),
  setIndex: z.number().int().min(0).max(100),
  reps: z.number().int().min(0).max(1000).nullable().optional(),
  loadKg: z.number().min(0).max(1000).nullable().optional(),
  distanceM: z.number().min(0).max(100000).nullable().optional(),
  timeS: z.number().min(0).max(100000).nullable().optional(),
  done: z.boolean(),
});

// Contrat V1.1 explicite : les anciennes cases cochées ne deviennent pas des kilos réalisés.
export const detailedSetInput = setLogInput
  .extend({
    itemRef: z.string().min(1).max(100),
    setKind: z.enum(["work", "warmup"]),
    loadKind: z.enum(["external", "bodyweight", "assisted"]),
    repetitionScope: z.enum(["total", "per_side"]),
    sideCount: z.union([z.literal(1), z.literal(2)]),
    groundContacts: z.number().int().min(0).max(2000).nullable().optional(),
  })
  .refine((s) => s.repetitionScope !== "total" || s.sideCount === 1, {
    message: "Des répétitions totales ne se multiplient pas par le nombre de côtés.",
    path: ["sideCount"],
  });
export type DetailedSetInput = z.infer<typeof detailedSetInput>;

// clientId rend l'envoi idempotent : la file hors ligne peut rejouer sans doublon.
export const sessionLogInput = z
  .object({
    clientId: z.string().min(8).max(64),
    status: z.enum(["done", "partial"]),
    variantDone: sessionVariant,
    // Une saisie de séries ne remplace pas le retour de séance déjà enregistré.
    writeScope: z.enum(["all", "sets", "status", "feedback"]).optional(),
    rpe: z.number().int().min(1).max(10).nullable().optional(),
    durationMin: z.number().int().min(1).max(600).nullable().optional(),
    comment: trimmed(1000).nullable().optional(),
    pain: painInput.nullable().optional(),
    sets: z.array(setLogInput).max(500).default([]),
    detailedSets: z.array(detailedSetInput).max(500).optional(),
    expectedVersion: z.number().int().min(0).optional(),
    expectedSessionVersion: z.number().int().min(1).optional(),
    completedAt: z.iso.datetime().optional(),
  })
  .superRefine((input, ctx) => {
    if (
      input.writeScope === "sets" &&
      (input.detailedSets === undefined ||
        input.rpe !== undefined ||
        input.pain !== undefined ||
        input.durationMin !== undefined ||
        input.comment !== undefined)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["writeScope"],
        message: "La saisie des séries ne modifie pas le retour de séance.",
      });
    }
    if (input.writeScope === "status" || input.writeScope === "feedback") {
      if (input.expectedVersion === undefined || input.expectedSessionVersion === undefined)
        ctx.addIssue({ code: "custom", path: ["expectedVersion"], message: "Les versions sont requises." });
      if (input.detailedSets !== undefined || (input.writeScope === "feedback" && input.sets.length > 0))
        ctx.addIssue({
          code: "custom",
          path: ["sets"],
          message: "Cette action ne remplace pas les séries détaillées.",
        });
      if (
        input.writeScope === "status" &&
        [input.rpe, input.pain, input.durationMin, input.comment].some((value) => value !== undefined)
      )
        ctx.addIssue({
          code: "custom",
          path: ["writeScope"],
          message: "La validation simple conserve le retour de séance.",
        });
    }
    if (
      input.detailedSets !== undefined &&
      (input.expectedVersion === undefined || input.expectedSessionVersion === undefined)
    )
      ctx.addIssue({
        code: "custom",
        path: ["expectedVersion"],
        message: "Les versions de la séance et de la saisie sont requises.",
      });
    const sets = input.detailedSets ?? input.sets;
    const keys = sets.map((s) => `${s.itemRef}:${s.setIndex}`);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: "custom", path: ["sets"], message: "Une série ne peut pas être présente deux fois." });
  });
export type SessionLogInput = z.input<typeof sessionLogInput>;

// Le motif est facultatif, et n'a de sens qu'avec une absence : il est ignoré avec « je viens ».
export const attendanceInput = z.object({
  status: z.enum(["present", "absent"]),
  reason: absenceReason.optional(),
});

export const rollCallInput = z.object({
  entries: z
    .array(z.object({ athleteId: uuid, status: attendanceStatus }))
    .min(1)
    .max(300),
});
export type RollCallInput = z.infer<typeof rollCallInput>;

export const remindInput = z.object({
  athleteIds: z.array(uuid).max(300).optional(),
});

export const announcementInput = z.object({
  groupId: uuid,
  body: required(2000, "Écris ton message"),
  pinned: z.boolean().default(false),
});
export type AnnouncementInput = z.input<typeof announcementInput>;

export const commentInput = z.object({
  entityType: commentEntity,
  entityId: uuid,
  body: required(2000, "Écris ton commentaire"),
  // Rend la file hors ligne idempotente : un rejeu ne crée pas de doublon.
  clientId: z.string().min(8).max(64).optional(),
});
export type CommentInput = z.infer<typeof commentInput>;

export const linkVideoExerciseInput = z.object({ exerciseId: uuid.nullable() });

export const createVideoInput = z.object({
  clientId: uuid.optional(),
  athleteId: uuid.optional(),
  scheduledSessionId: uuid.nullable().optional(),
  exerciseId: uuid.nullable().optional(),
  fps: z.number().int().min(1).max(1000).nullable().optional(),
  timeScale: z.number().int().min(1).max(64).optional(),
  recordedAt: z.iso.datetime().optional(),
  attempt: z
    .object({
      barHeightCm: z.number().int().min(50).max(700),
      attemptNo: z.number().int().min(1).max(3),
      result: jumpResult,
      approachSteps: z.number().int().min(1).max(40).nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type CreateVideoInput = z.infer<typeof createVideoInput>;

export const annotationInput = z.object({
  parentId: uuid.optional(),
  tMs: z.number().int().min(0),
  phase: jumpPhase.nullable().optional(),
  text: required(500, "Écris ta remarque"),
});
export type AnnotationInput = z.infer<typeof annotationInput>;

export const shareVideoInput = z.object({
  groupIds: z.array(uuid).max(50).optional(),
  withAthlete: z.boolean(),
  withGroup: z.boolean().default(false),
});

export const jumpAttemptInput = z.object({
  athleteId: uuid,
  scheduledSessionId: uuid.nullable().optional(),
  competitionId: uuid.nullable().optional(),
  barHeightCm: z.number().int().min(50).max(700),
  attemptNo: z.number().int().min(1).max(3),
  result: jumpResult,
  approachSteps: z.number().int().min(1).max(40).nullable().optional(),
  takeoffDistanceCm: z.number().int().min(0).max(1000).nullable().optional(),
  videoId: uuid.nullable().optional(),
  clientId: z.string().min(8).max(64).optional(),
});
export type JumpAttemptInput = z.infer<typeof jumpAttemptInput>;

export const deviceInput = z.object({
  pushToken: z.string().min(8).max(4096),
  platform: devicePlatform,
  appVersion: z.string().min(1).max(32).optional(),
  updateId: z.string().min(1).max(64).nullable().optional(),
  installationId: uuid.optional(),
});

export const checkInInput = z.object({
  installationId: uuid,
  platform: devicePlatform,
  appVersion: z.string().min(1).max(32),
  updateId: z.string().min(1).max(64).nullable().optional(),
  pushToken: z.string().min(8).max(4096).optional(),
});
export type CheckInInput = z.infer<typeof checkInInput>;

export const markNotificationsInput = z
  .object({ ids: z.array(uuid).min(1).max(100).optional(), all: z.literal(true).optional() })
  .refine((value) => Boolean(value.ids) !== Boolean(value.all), { message: "Précise les notifications" });

export const notificationsQuery = z.object({
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const releaseStatusQuery = z.object({
  platform: z.enum(["ios", "android"]),
  version: z.string().min(1).max(32),
});

export const releaseSeenInput = z.object({ releaseId: z.string().min(1).max(64) });

export const reportContentInput = z.object({
  entityType: z.enum(["comment", "video", "announcement"]),
  entityId: uuid,
  reason: reportReason,
  detail: trimmed(1000).nullable().optional(),
});

export const blockUserInput = z.object({ userId: uuid });

export const trackingQuery = z.object({
  week: isoDate.optional(),
  groupId: uuid.optional(),
});

// Un mois complet s'affiche sur 42 jours ; la marge couvre les préchargements sans ouvrir une lecture sans borne.
export const MAX_CALENDAR_RANGE_DAYS = 62;
const rangeDays = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

export const rangeQuery = z
  .object({
    from: isoDate,
    to: isoDate,
    groupId: uuid.optional(),
    // Durée, exercices et réalisation : calculés à la demande pour ne pas alourdir les petites lectures.
    summary: z.enum(["true", "false"]).optional(),
  })
  .refine(({ from, to }) => rangeDays(from, to) >= 0 && rangeDays(from, to) <= MAX_CALENDAR_RANGE_DAYS, {
    message: "Période de calendrier invalide",
    path: ["to"],
  });

export const sessionTypeFilter = sessionType.optional();
export const logStatusFilter = logStatus.optional();

export const platformSettingsInput = z.object({
  signupMode: z.enum(["closed", "public"]),
  checkoutEnabled: z.boolean(),
  muxVideoLimit: z.number().int().positive().nullable(),
  // Classement public du jeu : éteint tant que le juriste n'a pas répondu (docs/reference/conformite.md).
  gameLeaderboardEnabled: z.boolean().default(false),
});
export type PlatformSettings = z.infer<typeof platformSettingsInput>;
