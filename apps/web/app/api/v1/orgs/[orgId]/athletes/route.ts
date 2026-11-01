import { authRoute } from "@/lib/zod-route";
import { listAthletes } from "@/server/athlete.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => listAthletes(ctx.actor.userId, params.orgId));
