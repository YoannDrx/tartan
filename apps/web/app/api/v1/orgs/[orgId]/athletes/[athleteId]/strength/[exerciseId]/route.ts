import { chooseStrengthReference, uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { getExerciseStrength, selectStrengthReference } from "@/server/strength.service";
import { orgParams } from "../../../../../../_params";

const params = orgParams.extend({ athleteId: uuid, exerciseId: uuid });
export const GET = authRoute
  .params(params)
  .handler(async (_req, { ctx, params }) =>
    getExerciseStrength(ctx.actor.userId, params.orgId, params.athleteId, params.exerciseId),
  );
export const PUT = authRoute
  .params(params)
  .body(chooseStrengthReference)
  .handler(async (_req, { ctx, params, body }) =>
    selectStrengthReference(ctx.actor.userId, params.orgId, params.athleteId, params.exerciseId, body),
  );
