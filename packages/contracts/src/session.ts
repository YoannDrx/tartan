import { z } from "zod";
import { blockVariant, exerciseCategory, sessionType } from "./enums";

export const uuid = z.uuid();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");
export const clockTime = z.string().regex(/^\d{2}:\d{2}$/, "Heure attendue au format HH:MM");

export const loadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("kg"), value: z.number().min(0).max(1000) }),
  z.object({
    type: z.literal("pct_1rm"),
    value: z.number().min(1).max(150),
    test: z.string().min(1).max(60),
  }),
]);

// Prescription souple, stockée en JSONB (cahier des charges § 12.3).
export const prescriptionSchema = z.object({
  sets: z.number().int().min(1).max(50).optional(),
  reps: z.number().int().min(1).max(500).optional(),
  unit: z.string().max(30).optional(),
  count: z.number().int().min(0).max(1000).optional(),
  height_cm: z.number().min(0).max(400).optional(),
  distance_m: z.number().min(0).max(20000).optional(),
  duration_s: z.number().int().min(0).max(14400).optional(),
  rest_s: z.number().int().min(0).max(3600).optional(),
  load: loadSchema.optional(),
  // Cible de prescription, indépendante de la charge et de l'effort réellement déclaré.
  intensityTarget: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("rpe"), value: z.number().min(1).max(10) }),
      z.object({ type: z.literal("rir"), value: z.number().int().min(0).max(10) }),
    ])
    .optional(),
  tempo: z.string().max(20).optional(),
  ground_contacts: z.number().int().min(0).max(2000).optional(),
  notes: z.string().max(500).optional(),
});
export type Prescription = z.infer<typeof prescriptionSchema>;

export const exerciseMediaSnapshot = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("upload"),
    muxPlaybackId: z.string().nullable(),
    title: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("youtube"),
    youtubeId: z.string(),
    title: z.string().nullable(),
    author: z.string().nullable().optional(),
    startS: z.number().int().nullable(),
    endS: z.number().int().nullable(),
  }),
  z.object({
    kind: z.literal("instagram"),
    instagramCode: z.string(),
    title: z.string().nullable(),
    author: z.string().nullable().optional(),
    embeddable: z.boolean().optional(),
  }),
]);
export type ExerciseMediaSnapshot = z.infer<typeof exerciseMediaSnapshot>;

export const snapshotItem = z.object({
  ref: z.string(),
  exerciseId: z.string().nullable(),
  name: z.string(),
  category: exerciseCategory,
  cues: z.array(z.string()),
  media: exerciseMediaSnapshot.nullable(),
  prescription: prescriptionSchema,
  strengthLoadKind: z.enum(["external_total", "added_weight", "assistance", "bodyweight"]).nullable().optional(),
  loadStepKg: z.number().positive().optional(),
  resolvedLoadKg: z.number().nullable().optional(),
  strengthReference: z
    .object({
      id: uuid,
      exerciseKey: z.string(),
      value: z.number(),
      kind: z.string(),
      date: isoDate,
      originKind: z.string().optional(),
      sourceTestId: uuid.nullable().optional(),
      loadKind: z.string().nullable().optional(),
      stepKg: z.number().positive().optional(),
    })
    .nullable()
    .optional(),
});
export type SnapshotItem = z.infer<typeof snapshotItem>;

export const snapshotBlock = z.object({
  ref: z.string(),
  name: z.string(),
  variant: blockVariant,
  items: z.array(snapshotItem),
});
export type SnapshotBlock = z.infer<typeof snapshotBlock>;

// Copie figée de la séance au moment de la publication.
export const sessionSnapshot = z.object({
  title: z.string(),
  type: sessionType,
  durationMin: z.number().int().nullable(),
  coachNote: z.string().nullable(),
  blocks: z.array(snapshotBlock),
});
export type SessionSnapshot = z.infer<typeof sessionSnapshot>;

export const sessionDraftItem = z.object({
  ref: z.string().min(1).max(100).optional(),
  exerciseId: uuid,
  prescription: prescriptionSchema,
});

export const sessionDraftBlock = z.object({
  ref: z.string().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(80),
  variant: blockVariant,
  items: z.array(sessionDraftItem).max(60),
});

export const sessionDraft = z.object({
  title: z.string().trim().min(1, "Donne un titre à la séance").max(120),
  type: sessionType,
  durationMin: z.number().int().min(1).max(600).nullable(),
  coachNote: z.string().trim().max(280).nullable(),
  blocks: z.array(sessionDraftBlock).min(1, "Ajoute au moins un bloc").max(12),
});
export type SessionDraft = z.infer<typeof sessionDraft>;

export const assignmentTarget = z.object({
  targetType: z.enum(["group", "athlete"]),
  targetId: uuid,
});
export type AssignmentTarget = z.infer<typeof assignmentTarget>;

export const athleteOverrideInput = z.object({
  athleteId: uuid,
  itemRef: z.string(),
  prescription: prescriptionSchema,
});

export const saveScheduledSessionInput = z.object({
  id: uuid.optional(),
  expectedVersion: z.number().int().min(1).optional(),
  date: isoDate,
  startTime: clockTime.nullable(),
  location: z.string().trim().max(120).nullable(),
  draft: sessionDraft,
  assignments: z.array(assignmentTarget).max(200),
  overrides: z.array(athleteOverrideInput).max(500).default([]),
  publishAt: z.iso.datetime().nullable().default(null),
});
export type SaveScheduledSessionInput = z.infer<typeof saveScheduledSessionInput>;

export const sessionSaveResult = z.object({ id: uuid, version: z.number().int().min(1) });
export const sessionEditResponse = saveScheduledSessionInput.extend({
  id: uuid,
  version: z.number().int().min(1),
  expectedVersion: z.number().int().min(1),
  publishedAt: z.iso.datetime().nullable(),
  logCount: z.number().int().min(0),
});
export type SessionEditResponse = z.infer<typeof sessionEditResponse>;
