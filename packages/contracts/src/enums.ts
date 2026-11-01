import { z } from "zod";

export const orgRole = z.enum(["owner", "coach", "assistant", "athlete", "guardian"]);
export type OrgRole = z.infer<typeof orgRole>;

export const staffRole = z.enum(["owner", "coach", "assistant"]);
export const invitationRole = z.enum(["athlete", "coach", "assistant"]);
export type InvitationRole = z.infer<typeof invitationRole>;

export const invitationKind = z.enum(["group_link", "qr", "personal_email", "personal_sms"]);
export type InvitationKind = z.infer<typeof invitationKind>;

export const invitationStatus = z.enum(["sent", "opened", "accepted", "expired", "revoked"]);
export type InvitationStatus = z.infer<typeof invitationStatus>;

export const exerciseCategory = z.enum([
  "strength",
  "plyo",
  "running_drill",
  "stairs",
  "cones",
  "mobility",
  "jump",
  "warmup",
]);
export type ExerciseCategory = z.infer<typeof exerciseCategory>;

export const sessionType = z.enum(["strength", "plyo", "running", "stairs", "cones", "mobility", "jump"]);
export type SessionType = z.infer<typeof sessionType>;

export const blockVariant = z.enum(["club", "autonomous", "both"]);
export type BlockVariant = z.infer<typeof blockVariant>;

export const sessionVariant = z.enum(["club", "autonomous"]);
export type SessionVariant = z.infer<typeof sessionVariant>;

export const logStatus = z.enum(["done", "partial", "missed", "skipped"]);
export type LogStatus = z.infer<typeof logStatus>;

export const cellStatus = z.enum(["done", "partial", "missed", "upcoming"]);
export type CellStatus = z.infer<typeof cellStatus>;

export const attendanceStatus = z.enum(["present", "absent", "unknown"]);
export type AttendanceStatus = z.infer<typeof attendanceStatus>;

export const bodySide = z.enum(["left", "right", "both", "none"]);
export type BodySide = z.infer<typeof bodySide>;

export const bodyArea = z.enum([
  "ankle",
  "foot",
  "achilles",
  "calf",
  "shin",
  "knee",
  "hamstring",
  "quadriceps",
  "groin",
  "hip",
  "back",
  "shoulder",
  "arm",
  "other",
]);
export type BodyArea = z.infer<typeof bodyArea>;

export const injuryStatus = z.enum(["active", "recovering", "resolved"]);
export const strengthTestKind = z.enum(["one_rm", "three_rm", "estimated"]);
export type StrengthTestKind = z.infer<typeof strengthTestKind>;

export const jumpResult = z.enum(["O", "X", "pass"]);
export type JumpResult = z.infer<typeof jumpResult>;

export const videoStatus = z.enum(["uploading", "processing", "ready", "error"]);
export type VideoStatus = z.infer<typeof videoStatus>;

export const jumpPhase = z.enum(["approach", "penultimate", "takeoff", "clearance", "landing"]);
export type JumpPhase = z.infer<typeof jumpPhase>;

export const annotationKind = z.enum(["comment", "line", "arrow", "angle"]);
export const commentEntity = z.enum(["session", "log", "video"]);
export type CommentEntity = z.infer<typeof commentEntity>;

export const consentKind = z.enum(["terms", "health", "video"]);
export type ConsentKind = z.infer<typeof consentKind>;

export const devicePlatform = z.enum(["ios", "android", "web"]);
export const takeoffFoot = z.enum(["left", "right"]);

export const reportReason = z.enum(["inappropriate", "harassment", "privacy", "other"]);
