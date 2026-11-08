import { Directory, File, Paths } from "expo-file-system";
import { isPlannerRecordingName } from "./planner-recording-core";

let recordingActive = false;

// expo-audio écrit dans cache/ sur iOS, cache/Audio/ sur Android (SDK 55).
// Notre extension permet de supprimer seulement les dictées, jamais les vidéos.
export function purgeAbandonedPlannerRecordings(): void {
  if (recordingActive) return;
  for (const directory of [Paths.cache, new Directory(Paths.cache, "Audio")]) {
    if (!directory.exists) continue;
    for (const entry of directory.list()) {
      if (entry instanceof File && isPlannerRecordingName(entry.name)) entry.delete();
    }
  }
}

export function claimPlannerRecorder(): () => void {
  if (recordingActive) throw new Error("dictation_busy");
  try {
    purgeAbandonedPlannerRecordings();
  } catch {
    throw new Error("dictation_cleanup_failed");
  }
  recordingActive = true;
  return () => {
    recordingActive = false;
  };
}
