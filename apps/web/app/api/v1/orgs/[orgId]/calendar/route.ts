import { rangeQuery } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { listCalendar } from "@/server/session.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .query(rangeQuery)
  .handler(async (_req, { ctx, params, query }) => listCalendar(ctx.actor.userId, params.orgId, query));
