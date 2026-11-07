import { authRoute } from "@/lib/zod-route";
import { getSessionBuilderContext } from "@/server/session-builder.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => getSessionBuilderContext(ctx.actor.userId, params.orgId));
