import { trackingQuery } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { getTrackingGrid } from "@/server/tracking.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .query(trackingQuery)
  .handler(async (_req, { ctx, params, query }) => getTrackingGrid(ctx.actor.userId, params.orgId, query));
