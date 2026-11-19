import { exerciseListOrder } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { reorderExerciseLists } from "@/server/exercise-list.service";
import { orgParams } from "../../../../_params";

export const PUT = authRoute
  .params(orgParams)
  .body(exerciseListOrder)
  .handler(async (_req, { ctx, params, body }) => {
    await reorderExerciseLists(ctx.actor.userId, params.orgId, body);
    return { ok: true };
  });
