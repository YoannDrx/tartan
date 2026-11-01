import { uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { athleteWeeklyStats } from "@/server/stats.service";
import { orgParams } from "../../../../../_params";

export const GET = authRoute
  .params(orgParams.extend({ athleteId: uuid }))
  .handler(async (_req, { ctx, params }) => athleteWeeklyStats(ctx.actor.userId, params.orgId, params.athleteId));
