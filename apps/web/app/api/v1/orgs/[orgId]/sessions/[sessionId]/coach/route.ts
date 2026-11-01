import { authRoute } from "@/lib/zod-route";
import { getSessionDetailForCoach } from "@/server/tracking.service";
import { sessionParams } from "../../../../../_params";

export const GET = authRoute
  .params(sessionParams)
  .handler(async (_req, { ctx, params }) => getSessionDetailForCoach(ctx.actor.userId, params.orgId, params.sessionId));
