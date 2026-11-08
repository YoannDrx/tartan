import { authRoute } from "@/lib/zod-route";
import { exportSpace } from "@/server/space-export.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => exportSpace(ctx.actor.userId, params.orgId));
