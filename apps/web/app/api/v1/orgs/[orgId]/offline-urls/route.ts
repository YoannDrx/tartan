import { authRoute } from "@/lib/zod-route";
import { offlineUrls } from "@/server/offline.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => offlineUrls(ctx.actor.userId, params.orgId));
