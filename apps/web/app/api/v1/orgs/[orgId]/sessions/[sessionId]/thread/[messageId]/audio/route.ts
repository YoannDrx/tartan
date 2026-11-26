import { threadMessageParams, threadTarget } from "@/lib/thread-route";
import { voiceResponse } from "@/lib/voice-http";
import { voiceRoute } from "@/lib/voice-route";
import { readThreadAudio } from "@/server/session-thread.service";

export const GET = voiceRoute(threadMessageParams, async (request, userId, { orgId, sessionId, messageId }) =>
  voiceResponse(request, await readThreadAudio(userId, orgId, sessionId, threadTarget(request), messageId)),
);
