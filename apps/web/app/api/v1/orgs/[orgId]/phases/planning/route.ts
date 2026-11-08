import { phasePlanningQuery } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { getPhasePlanning } from "@/server/training-phases.service";
import { orgParams } from "../../../../_params";

export const POST = authRoute
  .params(orgParams)
  .body(phasePlanningQuery)
  .handler(async (_request, { ctx, params, body }) => getPhasePlanning(ctx.actor.userId, params.orgId, body));
