import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  setAudioModeAsync,
  type AudioRecorder,
  type RecordingOptions,
} from "expo-audio";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import { claimPlannerRecorder } from "./planner-recording-files";
import {
  PLANNER_AUDIO_EXTENSION,
  PLANNER_AUDIO_MAX_BYTES,
  PLANNER_RECORDING_SECONDS,
  type DictationRecorder,
} from "./planner-recording-core";

const options: RecordingOptions = {
  extension: PLANNER_AUDIO_EXTENSION,
  sampleRate: 16_000,
  numberOfChannels: 1,
  bitRate: 32_000,
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MEDIUM },
  android: { outputFormat: "mpeg4", audioEncoder: "aac", maxFileSize: PLANNER_AUDIO_MAX_BYTES },
  web: { mimeType: "audio/webm", bitsPerSecond: 32_000 },
};

export function createNativeDictationRecorder(): DictationRecorder {
  const releaseClaim = claimPlannerRecorder();
  let recorder: AudioRecorder | null = null;
  let uri: string | null = null;
  let audioModeChanged = false;
  let disposed = false;
  return {
    prepare: async (signal) => {
      if (signal.aborted) throw new Error("dictation_cancelled");
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (signal.aborted) throw new Error("dictation_cancelled");
      if (!permission.granted) throw new Error("dictation_permission_denied");
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        allowsBackgroundRecording: false,
      });
      audioModeChanged = true;
      if (signal.aborted) throw new Error("dictation_cancelled");
      // Le constructeur attend les options de plateforme à plat, comme useAudioRecorder.
      recorder = new AudioModule.AudioRecorder({
        ...options,
        ...(Platform.OS === "ios" ? options.ios : options.android),
      });
      await recorder.prepareToRecordAsync();
      uri = recorder.uri;
    },
    start: () => {
      if (!recorder) throw new Error("dictation_not_ready");
      recorder.record({ forDuration: PLANNER_RECORDING_SECONDS });
    },
    stop: async () => {
      if (!recorder) throw new Error("dictation_not_ready");
      // stop reste nécessaire après l'arrêt automatique Android (taille/durée).
      await recorder.stop();
      uri = recorder.uri ?? uri;
      if (!uri) throw new Error("dictation_invalid_audio");
      const file = new File(uri);
      return { uri, size: file.exists ? file.size : 0 };
    },
    dispose: async () => {
      if (disposed) return;
      disposed = true;
      let failed = false;
      try {
        if (recorder) {
          uri = recorder.uri ?? uri;
          try {
            if (recorder.isRecording) await recorder.stop();
          } catch {
            failed = true;
          }
          uri = recorder.uri ?? uri;
          try {
            recorder.release();
          } catch {
            failed = true;
          }
        }
        if (uri) {
          try {
            const file = new File(uri);
            if (file.exists) file.delete();
          } catch {
            failed = true;
          }
        }
        if (audioModeChanged) {
          try {
            await setAudioModeAsync({ allowsRecording: false });
          } catch {
            failed = true;
          }
        }
      } finally {
        releaseClaim();
      }
      if (failed) throw new Error("dictation_cleanup_failed");
    },
  };
}
