import "server-only";
import { randomUUID } from "node:crypto";
import { m } from "@tartan/i18n";
import { AppError, invalid } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { inspectRecordedAudio } from "@/lib/recorded-audio";
import { openAiTranscriptionProvider } from "./ai/transcription-provider";
import { readThreadTranscriptionSource, saveThreadTranscript } from "./session-thread.service";

export async function transcribeSessionThreadVoice(
  userId: string,
  orgId: string,
  sessionId: string,
  target: { itemRef?: string; athleteId?: string },
  messageId: string,
  input: { consent: true; version: string },
  provider = openAiTranscriptionProvider(fetch, "session"),
) {
  if (input.consent !== true) throw invalid();
  const args = [userId, orgId, sessionId, target, messageId, input.version] as const;
  const source = await readThreadTranscriptionSource(...args);
  if (source.transcript !== null) return source.transcript;

  // La version identifie les octets, y compris pour une même consigne utilisée dans plusieurs séances.
  // Une lease est plus longue que le délai HTTP, sans immobiliser une connexion pendant l'appel.
  const token = randomUUID();
  const claimed = await prisma.$executeRaw`
    INSERT INTO session_transcription_leases (voice_version, token, expires_at)
    VALUES (${input.version}::uuid, ${token}::uuid, CURRENT_TIMESTAMP + INTERVAL '2 minutes')
    ON CONFLICT (voice_version) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at
    WHERE session_transcription_leases.expires_at < CURRENT_TIMESTAMP`;
  if (!claimed) throw new AppError(409, "transcription_in_progress", m.sessionThread.transcriptionBusy);
  try {
    // Une requête concurrente peut avoir enregistré puis libéré la version entre la première lecture et la prise.
    const current = await readThreadTranscriptionSource(...args);
    if (current.transcript !== null) return current.transcript;
    await enforceRateLimit(`session-thread-transcription/${userId}`, 30, 600);
    const audio = await inspectRecordedAudio(new Uint8Array(current.bytes), () => invalid(m.errors.voiceInvalid));
    let transcript: string;
    try {
      transcript = await provider.transcribe(audio);
    } catch {
      throw new AppError(503, "transcription_unavailable", m.sessionThread.transcriptionError);
    }
    return await saveThreadTranscript(...args, transcript);
  } finally {
    await prisma.sessionTranscriptionLease.deleteMany({ where: { voiceVersion: input.version, token } });
  }
}
