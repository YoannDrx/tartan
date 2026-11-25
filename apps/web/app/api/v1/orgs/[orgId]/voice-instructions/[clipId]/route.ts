import { uuid } from "@tartan/contracts";
import { voiceResponse } from "@/lib/voice-http";
import { optionalVoiceTarget, voiceRoute } from "@/lib/voice-route";
import { readVoiceInstruction } from "@/server/session-voice.service";
import { orgParams } from "../../../../_params";

export const GET = voiceRoute(orgParams.extend({ clipId: uuid }), async (request, userId, { orgId, clipId }) =>
  voiceResponse(request, await readVoiceInstruction(userId, orgId, clipId, optionalVoiceTarget(request, "sessionId"))),
);
