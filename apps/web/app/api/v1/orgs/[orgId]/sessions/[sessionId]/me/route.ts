import { authRoute } from "@/lib/zod-route";
import { getAthleteSession } from "@/server/athlete-view.service";
import { sessionParams } from "../../../../../_params";

export const GET = authRoute
  .params(sessionParams)
  .handler(async (_req, { ctx, params }) => getAthleteSession(ctx.actor.userId, params.orgId, params.sessionId));
