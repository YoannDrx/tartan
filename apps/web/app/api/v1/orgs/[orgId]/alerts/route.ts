import { authRoute } from "@/lib/zod-route";
import { getAlerts } from "@/server/tracking.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => getAlerts(ctx.actor.userId, params.orgId));
