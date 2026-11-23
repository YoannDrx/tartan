import { uuid } from "@tartan/contracts";
import { z } from "zod";
import { authRoute } from "@/lib/zod-route";
import { getSharedHistory } from "@/server/history-share.service";

// L'historique personnel qu'un athlète partage avec ses coachs : lecture seule, contrôlée et tracée à chaque appel.
export const GET = authRoute
  .params(z.object({ orgId: uuid, athleteId: uuid }))
  .handler(async (_req, { ctx, params }) => ({
    history: await getSharedHistory(ctx.actor.userId, params.orgId, params.athleteId),
  }));
