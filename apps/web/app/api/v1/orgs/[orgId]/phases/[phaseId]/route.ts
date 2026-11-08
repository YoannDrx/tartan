import { uuid } from "@tartan/contracts";
import { z } from "zod";
import { authRoute } from "@/lib/zod-route";
import { deleteTrainingPhase } from "@/server/training-phases.service";
import { orgParams } from "../../../../_params";

export const DELETE = authRoute
  .params(orgParams.extend({ phaseId: uuid }))
  .query(z.object({ expectedVersion: z.coerce.number().int().positive() }).strict())
  .handler(async (_req, { ctx, params, query }) =>
    deleteTrainingPhase(ctx.actor.userId, params.orgId, params.phaseId, query),
  );
