import { saveTrainingPhaseInput, trainingPhaseQuery } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { listTrainingPhases, saveTrainingPhase } from "@/server/training-phases.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .query(trainingPhaseQuery)
  .handler(async (_req, { ctx, params, query }) => listTrainingPhases(ctx.actor.userId, params.orgId, query));
export const POST = authRoute
  .params(orgParams)
  .body(saveTrainingPhaseInput)
  .handler(async (_req, { ctx, params, body }) => saveTrainingPhase(ctx.actor.userId, params.orgId, body));
