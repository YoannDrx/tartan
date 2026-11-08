import { trainingAnalysisQuery } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { getTrainingAnalysis } from "@/server/training-analysis.service";
import { orgParams } from "../../../_params";
export const GET = authRoute
  .params(orgParams)
  .query(trainingAnalysisQuery)
  .handler(async (_req, { ctx, params, query }) => getTrainingAnalysis(ctx.actor.userId, params.orgId, query));
