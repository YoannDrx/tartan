import { sessionThreadTranscriptionInput } from "@tartan/contracts";
import { threadMessageParams, threadTarget } from "@/lib/thread-route";
import { voiceRoute } from "@/lib/voice-route";
import { readJsonBody } from "@/lib/zod-route";
import { transcribeSessionThreadVoice } from "@/server/session-thread-transcription.service";

export const maxDuration = 120;

export const POST = voiceRoute(threadMessageParams, async (request, userId, { orgId, sessionId, messageId }) => {
  const input = await readJsonBody(request, sessionThreadTranscriptionInput);
  const transcript = await transcribeSessionThreadVoice(
    userId,
    orgId,
    sessionId,
    threadTarget(request),
    messageId,
    input,
  );
  return Response.json({ transcript }, { headers: { "Cache-Control": "private, no-store" } });
});
