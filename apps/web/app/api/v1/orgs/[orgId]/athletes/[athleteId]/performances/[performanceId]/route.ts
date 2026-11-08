import { performanceFields, uuid } from "@tartan/contracts";
import { z } from "zod";
import { authRoute } from "@/lib/zod-route";
import { updatePerformance, deletePerformance } from "@/server/performance.service";
import { orgParams } from "../../../../../../_params";
const params = orgParams.extend({ athleteId: uuid, performanceId: uuid });
export const PUT = authRoute
  .params(params)
  .body(performanceFields.omit({ athleteId: true }).extend({ expectedVersion: z.number().int().positive() }).strict())
  .handler(async (_req, { ctx, params, body }) =>
    updatePerformance(ctx.actor.userId, params.orgId, {
      ...body,
      id: params.performanceId,
      athleteId: params.athleteId,
    }),
  );
export const DELETE = authRoute
  .params(params)
  .query(z.object({ expectedVersion: z.coerce.number().int().positive() }).strict())
  .handler(async (_req, { ctx, params, query }) =>
    deletePerformance(ctx.actor.userId, params.orgId, params.performanceId, query.expectedVersion, params.athleteId),
  );
