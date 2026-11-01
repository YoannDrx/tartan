import { rangeQuery } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { getAthleteCalendar } from "@/server/athlete-view.service";
import { orgParams } from "../../../../_params";

export const GET = authRoute
  .params(orgParams)
  .query(rangeQuery)
  .handler(async (_req, { ctx, params, query }) => getAthleteCalendar(ctx.actor.userId, params.orgId, query));
