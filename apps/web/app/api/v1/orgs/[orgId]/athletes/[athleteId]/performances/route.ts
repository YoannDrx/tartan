import { performanceFields, uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { addPerformance } from "@/server/performance.service";
import { orgParams } from "../../../../../_params";
export const POST = authRoute
  .params(orgParams.extend({ athleteId: uuid }))
  .body(performanceFields.omit({ athleteId: true }).extend({ clientId: uuid }).strict())
  .handler(async (_req, { ctx, params, body }) =>
    addPerformance(ctx.actor.userId, params.orgId, { ...body, athleteId: params.athleteId }),
  );
