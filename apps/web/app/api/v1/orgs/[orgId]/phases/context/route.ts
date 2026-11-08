import { authRoute } from "@/lib/zod-route";
import { getTrainingPhaseContext } from "@/server/training-phases.service";
import { orgParams } from "../../../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => getTrainingPhaseContext(ctx.actor.userId, params.orgId));
