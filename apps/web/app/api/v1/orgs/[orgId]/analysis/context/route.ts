import { authRoute } from "@/lib/zod-route";
import { getTrainingAnalysisContext } from "@/server/training-analysis.service";
import { orgParams } from "../../../../_params";
export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => getTrainingAnalysisContext(ctx.actor.userId, params.orgId));
