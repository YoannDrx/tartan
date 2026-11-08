import "server-only";
import { BufferSource, Input, MP4, WEBM, WAVE } from "mediabunny";
import { PLANNER_MAX_AUDIO_BYTES, plannerAudioIsWithinLimits } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { AppError } from "@/lib/errors";

const invalidAudio = () => new AppError(400, "planner_audio_invalid", m.aiPlanner.audioInvalid);
export type PlannerAudio = {
  bytes: Uint8Array<ArrayBuffer>;
  durationSeconds: number;
  audioSeconds: number;
  mimeType: "audio/mp4" | "audio/webm" | "audio/wav";
  extension: "m4a" | "webm" | "wav";
};

// Détection dans les octets et durée des paquets, sans faire confiance au MIME,
// au nom de fichier ou à une durée annoncée par le client. Aucun fichier écrit.
export async function inspectPlannerAudio(bytes: Uint8Array<ArrayBuffer>): Promise<PlannerAudio> {
  if (!bytes.byteLength || bytes.byteLength > PLANNER_MAX_AUDIO_BYTES) throw invalidAudio();
  const input = new Input({ source: new BufferSource(bytes), formats: [MP4, WEBM, WAVE] });
  const timeout = setTimeout(() => input.dispose(), 5000);
  try {
    const format = await input.getFormat();
    const tracks = await input.getTracks();
    if (tracks.length !== 1 || !tracks[0]?.isAudioTrack()) throw invalidAudio();
    const track = tracks[0];
    if (!(await track.getCodec())) throw invalidAudio();
    const firstTimestamp = await track.getFirstTimestamp();
    const endTimestamp = await track.computeDuration({ skipLiveWait: true });
    // Inclure également une éventuelle avance de décodage négative.
    const durationSeconds = endTimestamp - Math.min(0, firstTimestamp);
    if (!Number.isFinite(firstTimestamp) || !plannerAudioIsWithinLimits(bytes.byteLength, durationSeconds))
      throw invalidAudio();
    const kind =
      format === MP4
        ? { mimeType: "audio/mp4" as const, extension: "m4a" as const }
        : format === WEBM
          ? { mimeType: "audio/webm" as const, extension: "webm" as const }
          : { mimeType: "audio/wav" as const, extension: "wav" as const };
    return { bytes, durationSeconds, audioSeconds: Math.ceil(durationSeconds), ...kind };
  } catch {
    throw invalidAudio();
  } finally {
    clearTimeout(timeout);
    input.dispose();
  }
}
