import { uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { setListMembership } from "@/server/exercise-list.service";
import { orgParams } from "../../../../../../_params";

const itemParams = orgParams.extend({ listId: uuid, exerciseId: uuid });

// Ranger une fiche dans une liste du coach, ou l'en retirer : la fiche reste dans la bibliothèque.
export const PUT = authRoute.params(itemParams).handler(async (_req, { ctx, params }) => {
  await setListMembership(ctx.actor.userId, params.orgId, params.listId, params.exerciseId, true);
  return { ok: true };
});

export const DELETE = authRoute.params(itemParams).handler(async (_req, { ctx, params }) => {
  await setListMembership(ctx.actor.userId, params.orgId, params.listId, params.exerciseId, false);
  return { ok: true };
});
