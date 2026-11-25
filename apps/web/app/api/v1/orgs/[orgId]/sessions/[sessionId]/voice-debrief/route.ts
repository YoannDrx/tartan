import { forbidden } from "@/lib/errors";
import { voiceResponse } from "@/lib/voice-http";
import { optionalVoiceTarget, voiceRoute } from "@/lib/voice-route";
import { deleteVoiceDebrief, putVoiceDebrief, readVoiceDebrief } from "@/server/session-voice.service";
import { sessionParams } from "../../../../../_params";

export const GET = voiceRoute(sessionParams, async (request, userId, { orgId, sessionId }) =>
  voiceResponse(request, await readVoiceDebrief(userId, orgId, sessionId, optionalVoiceTarget(request, "athleteId"))),
);

export const PUT = voiceRoute(sessionParams, async (request, userId, { orgId, sessionId }) => {
  if (optionalVoiceTarget(request, "athleteId")) throw forbidden();
  await putVoiceDebrief(userId, orgId, sessionId, request);
  return new Response(null, { status: 204 });
});

export const DELETE = voiceRoute(sessionParams, async (request, userId, { orgId, sessionId }) => {
  if (optionalVoiceTarget(request, "athleteId")) throw forbidden();
  await deleteVoiceDebrief(userId, orgId, sessionId);
  return new Response(null, { status: 204 });
});
