import { sessionLogInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { logSession } from "@/server/athlete-view.service";
import { sessionParams } from "../../../../../_params";

export const POST = authRoute
  .params(sessionParams)
  .body(sessionLogInput)
  .handler(async (_req, { ctx, params, body }) => logSession(ctx.actor.userId, params.orgId, params.sessionId, body));
