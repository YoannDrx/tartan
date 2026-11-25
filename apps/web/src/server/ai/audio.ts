import "server-only";
import { m } from "@tartan/i18n";
import { AppError } from "@/lib/errors";
import { inspectRecordedAudio, type RecordedAudio } from "@/lib/recorded-audio";

export type PlannerAudio = RecordedAudio;

export const inspectPlannerAudio = (bytes: Uint8Array<ArrayBuffer>) =>
  inspectRecordedAudio(bytes, () => new AppError(400, "planner_audio_invalid", m.aiPlanner.audioInvalid));
