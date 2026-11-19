import { exerciseListUpdate, uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { deleteExerciseList, updateExerciseList } from "@/server/exercise-list.service";
import { orgParams } from "../../../../_params";

const listParams = orgParams.extend({ listId: uuid });

// Renommer ou partager : seul le coach propriétaire de la liste.
export const PATCH = authRoute
  .params(listParams)
  .body(exerciseListUpdate)
  .handler(async (_req, { ctx, params, body }) => {
    await updateExerciseList(ctx.actor.userId, params.orgId, params.listId, body);
    return { ok: true };
  });

export const DELETE = authRoute.params(listParams).handler(async (_req, { ctx, params }) => {
  await deleteExerciseList(ctx.actor.userId, params.orgId, params.listId);
  return { ok: true };
});
