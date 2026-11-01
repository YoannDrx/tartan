import { authRoute } from "@/lib/zod-route";
import { getAthleteToday } from "@/server/athlete-view.service";
import { orgParams } from "../../../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => getAthleteToday(ctx.actor.userId, params.orgId));
