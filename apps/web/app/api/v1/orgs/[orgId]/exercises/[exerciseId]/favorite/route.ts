import { exerciseFavoriteInput, uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { setFavorite } from "@/server/exercise-list.service";
import { orgParams } from "../../../../../_params";

export const PUT = authRoute
  .params(orgParams.extend({ exerciseId: uuid }))
  .body(exerciseFavoriteInput)
  .handler(async (_req, { ctx, params, body }) => {
    await setFavorite(ctx.actor.userId, params.orgId, params.exerciseId, body.favorite);
    return { ok: true };
  });
