import { authRoute } from "@/lib/zod-route";
import { getMyFile } from "@/server/athlete.service";
import { orgParams } from "../../../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => getMyFile(ctx.actor.userId, params.orgId));
