import { authRoute } from "@/lib/zod-route";
import { listExercises } from "@/server/exercise.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => listExercises(ctx.actor.userId, params.orgId));
