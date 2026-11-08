import { trainingPhaseVisibilityInput, uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { setTrainingPhaseVisibility } from "@/server/training-phases.service";
import { orgParams } from "../../../../../_params";

export const PUT = authRoute
  .params(orgParams.extend({ phaseId: uuid }))
  .body(trainingPhaseVisibilityInput)
  .handler(async (_req, { ctx, params, body }) =>
    setTrainingPhaseVisibility(ctx.actor.userId, params.orgId, params.phaseId, body),
  );
