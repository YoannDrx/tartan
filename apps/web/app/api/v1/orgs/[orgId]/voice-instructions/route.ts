import { uploadVoiceInstruction } from "@/server/session-voice.service";
import { voiceRoute } from "@/lib/voice-route";
import { orgParams } from "../../../_params";

export const POST = voiceRoute(orgParams, async (request, userId, { orgId }) =>
  Response.json(await uploadVoiceInstruction(userId, orgId, request), {
    status: 201,
    headers: { "Cache-Control": "private, no-store" },
  }),
);
