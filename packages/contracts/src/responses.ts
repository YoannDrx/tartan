import { confirmedStrengthRecord, sessionCelebration } from "./strength-records";
import { z } from "zod";
import {
  attendanceStatus,
  cellStatus,
  jumpPhase,
  jumpResult,
  orgRole,
  sessionType,
  sessionVariant,
  videoStatus,
} from "./enums";
import { prescriptionSchema, snapshotBlock, snapshotItem, sessionDraft, uuid } from "./session";
import { detailedSetInput, painInput } from "./requests";

export const spaceSummary = z.object({
  organizationId: z.string(),
  organizationName: z.string(),
  progressionEnabled: z.boolean().optional(),
  phasesEnabled: z.boolean().optional(),
  role: orgRole,
  athleteId: z.string().nullable(),
});
export type SpaceSummary = z.infer<typeof spaceSummary>;

export const meResponse = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  birthDate: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  units: z.string(),
  locale: z.string(),
  spaces: z.array(spaceSummary),
});
export type MeResponse = z.infer<typeof meResponse>;

export const invitationPreview = z.object({
  organizationName: z.string(),
  inviterName: z.string(),
  inviterAvatarUrl: z.string().nullable(),
  groupNames: z.array(z.string()),
  role: z.enum(["athlete", "coach", "assistant"]),
  email: z.string().nullable(),
  state: z.enum(["valid", "expired", "revoked", "used"]),
});
export type InvitationPreview = z.infer<typeof invitationPreview>;

export const acceptInvitationResponse = z.object({
  organizationId: z.string(),
  athleteId: z.string().nullable(),
  parentalConsentRequired: z.boolean(),
});

export const athleteSessionCard = z.object({
  sessionVersion: z.number().int().min(1).optional(),
  logVersion: z.number().int().min(0).optional(),
  id: z.string(),
  title: z.string(),
  type: sessionType,
  date: z.string(),
  startTime: z.string().nullable(),
  location: z.string().nullable(),
  coachName: z.string().nullable(),
  coachNote: z.string().nullable(),
  durationMin: z.number().nullable(),
  exerciseCount: z.number(),
  variant: sessionVariant,
  hasAutonomous: z.boolean(),
  status: cellStatus,
  attendance: attendanceStatus,
});
export type AthleteSessionCard = z.infer<typeof athleteSessionCard>;

export const weekDayDot = z.object({
  date: z.string(),
  status: z.enum(["done", "partial", "missed", "today", "planned", "rest"]),
});

export const athleteToday = z.object({
  firstName: z.string().nullable(),
  today: z.array(athleteSessionCard),
  next: athleteSessionCard.nullable(),
  week: z.array(weekDayDot),
  pinnedAnnouncement: z.object({ id: z.string(), body: z.string(), authorName: z.string().nullable() }).nullable(),
  healthConsent: z.boolean(),
  videoConsent: z.boolean(),
  parentalConsentPending: z.boolean(),
});
export type AthleteToday = z.infer<typeof athleteToday>;

export const resolvedItem = z.object({
  ref: z.string(),
  exerciseId: z.string().nullable().optional(),
  name: z.string(),
  category: z.string(),
  cues: z.array(z.string()),
  media: z.unknown().nullable(),
  prescription: prescriptionSchema,
  strengthLoadKind: snapshotItem.shape.strengthLoadKind,
  loadStepKg: snapshotItem.shape.loadStepKg,
  resolvedLoadKg: z.number().nullable(),
  summary: z.string(),
});
export type ResolvedItem = z.infer<typeof resolvedItem>;

export const previousExerciseSets = z.object({
  exerciseId: uuid,
  convention: snapshotItem.shape.strengthLoadKind,
  date: z.string(),
  startTime: z.string().nullable(),
  sessionId: uuid,
  totalSets: z.number().int().nonnegative(),
  sets: z.array(detailedSetInput),
});
export type PreviousExerciseSets = z.infer<typeof previousExerciseSets>;

export const athleteSessionDetail = athleteSessionCard.extend({
  historyAthleteId: uuid.optional(),
  previousExerciseSets: z.array(previousExerciseSets).optional(),
  athlete: z.object({ id: z.string(), name: z.string() }).optional(),
  canRecordSets: z.boolean().optional(),
  progressionEnabled: z.boolean().optional(),
  healthConsent: z.boolean().optional(),
  sessionVersion: z.number().int().optional(),
  blocks: z.array(snapshotBlock.omit({ items: true }).extend({ items: z.array(resolvedItem) })),
  log: z
    .object({
      status: z.string(),
      rpe: z.number().nullable(),
      pain: painInput.nullable().optional(),
      durationMin: z.number().nullable(),
      comment: z.string().nullable(),
      version: z.number().int().optional(),
      clientId: z.string().nullable().optional(),
      detailedSets: z.array(detailedSetInput).optional(),
    })
    .nullable(),
});
export type AthleteSessionDetail = z.infer<typeof athleteSessionDetail>;

export const sessionLogResult = z.object({
  celebration: sessionCelebration.nullable().optional(),
  records: z.array(confirmedStrengthRecord).optional(),
  id: z.string(),
  replayed: z.boolean(),
  version: z.number().int().optional(),
});

export const trackingCell = z.object({
  sessionId: z.string(),
  status: cellStatus.nullable(),
  rpe: z.number().nullable(),
  hasPain: z.boolean(),
  variant: sessionVariant.nullable(),
});

export const trackingGrid = z.object({
  weekStart: z.string(),
  sessions: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      type: sessionType,
      date: z.string(),
      startTime: z.string().nullable(),
    }),
  ),
  rows: z.array(
    z.object({
      athleteId: z.string(),
      name: z.string(),
      initials: z.string(),
      groupNames: z.array(z.string()),
      activeInjury: z.string().nullable(),
      hasPain: z.boolean(),
      completionPct: z.number().nullable(),
      cells: z.array(trackingCell),
    }),
  ),
});
export type TrackingGrid = z.infer<typeof trackingGrid>;

export const coachAlert = z.object({
  id: z.string(),
  kind: z.enum(["pain", "missed_streak", "abnormal_rpe", "active_injury"]),
  athleteId: z.string(),
  athleteName: z.string(),
  title: z.string(),
  detail: z.string(),
  severity: z.enum(["high", "medium"]),
});
export type CoachAlert = z.infer<typeof coachAlert>;

export const videoSummary = z.object({
  id: z.string(),
  athleteId: z.string(),
  athleteName: z.string(),
  uploadedBy: z.string(),
  status: videoStatus,
  playbackId: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  consentRevoked: z.boolean().optional(),
  fps: z.number().nullable(),
  timeScale: z.number(),
  durationMs: z.number().nullable(),
  recordedAt: z.string().nullable(),
  sharedWithAthlete: z.boolean(),
  barHeightCm: z.number().nullable(),
  attemptNo: z.number().nullable(),
  result: jumpResult.nullable(),
  annotationCount: z.number(),
});
export type VideoSummary = z.infer<typeof videoSummary>;

export const videoDetail = videoSummary.extend({
  hlsUrl: z.string().nullable(),
  mp4Url: z.string().nullable(),
  annotations: z.array(
    z.object({
      id: z.string(),
      tMs: z.number(),
      phase: jumpPhase.nullable(),
      text: z.string().nullable(),
      authorName: z.string().nullable(),
    }),
  ),
  comments: z.array(
    z.object({
      id: z.string(),
      body: z.string(),
      authorName: z.string().nullable(),
      authorId: z.string(),
      createdAt: z.string(),
    }),
  ),
  barSheet: z.array(z.object({ heightCm: z.number(), label: z.string(), notation: z.string() })),
});
export type VideoDetail = z.infer<typeof videoDetail>;

export const createVideoResponse = z.object({
  videoId: z.string(),
  uploadUrl: z.string(),
});

export const announcementItem = z.object({
  id: z.string(),
  groupId: z.string(),
  groupName: z.string(),
  body: z.string(),
  pinned: z.boolean(),
  authorId: z.string(),
  authorName: z.string().nullable(),
  createdAt: z.string(),
});
export type AnnouncementItem = z.infer<typeof announcementItem>;

export const commentItem = z.object({
  id: z.string(),
  body: z.string(),
  authorId: z.string(),
  authorName: z.string().nullable(),
  createdAt: z.string(),
});
export type CommentItem = z.infer<typeof commentItem>;

export const exerciseSummary = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  cues: z.array(z.string()),
  defaultPrescription: prescriptionSchema,
  strengthLoadKind: z.enum(["external_total", "added_weight", "assistance", "bodyweight"]).nullable().optional(),
  loadStepKg: z.number().positive().optional(),
  media: z.unknown().nullable(),
  // Bibliothèque commune de Tartan : lisible par tous, modifiable par personne depuis un espace.
  shared: z.boolean().default(false),
});
export type ExerciseSummary = z.infer<typeof exerciseSummary>;

export const sessionBuilderContext = z.object({
  exercises: z.array(exerciseSummary),
  groups: z.array(z.object({ id: uuid, name: z.string(), athleteCount: z.number().int().min(0) })),
  athletes: z.array(z.object({ id: uuid, firstName: z.string(), lastName: z.string() })),
  templates: z.array(sessionDraft.extend({ id: uuid, canDelete: z.boolean().default(false) })),
  testKeys: z.array(z.string()),
});

export const calendarSession = z.object({
  id: z.string(),
  title: z.string(),
  type: sessionType,
  date: z.string(),
  startTime: z.string().nullable(),
  location: z.string().nullable(),
  publishedAt: z.string().nullable(),
  audience: z.string(),
  hasAutonomous: z.boolean(),
});
export type CalendarSession = z.infer<typeof calendarSession>;

export const calendarCompetition = z.object({
  id: z.string(),
  name: z.string(),
  date: z.string(),
  location: z.string().nullable(),
});

export const calendarResponse = z.object({
  sessions: z.array(calendarSession),
  competitions: z.array(calendarCompetition),
});
export type CalendarResponse = z.infer<typeof calendarResponse>;

export const okResponse = z.object({ ok: z.literal(true) });
export const apiError = z.object({ message: z.string(), code: z.string().optional() });
