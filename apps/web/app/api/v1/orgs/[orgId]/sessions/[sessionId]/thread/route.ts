import { threadTarget } from "@/lib/thread-route";
import { voiceRoute } from "@/lib/voice-route";
import { getSessionThread, postSessionThread } from "@/server/session-thread.service";
import { sessionParams } from "../../../../../_params";

const headers = { "Cache-Control": "private, no-store" };
export const GET = voiceRoute(sessionParams, async (request, userId, { orgId, sessionId }) =>
  Response.json(await getSessionThread(userId, orgId, sessionId, threadTarget(request)), { headers }),
);
export const POST = voiceRoute(sessionParams, async (request, userId, { orgId, sessionId }) =>
  Response.json(await postSessionThread(userId, orgId, sessionId, threadTarget(request), request), {
    status: 201,
    headers,
  }),
);
