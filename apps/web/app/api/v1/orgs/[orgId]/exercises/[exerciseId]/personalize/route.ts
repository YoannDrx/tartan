import { uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { personalizeExercise } from "@/server/exercise.service";
import { orgParams } from "../../../../../_params";

// La copie d'une fiche commune dans l'espace, guide et geste compris.
export const POST = authRoute
  .params(orgParams.extend({ exerciseId: uuid }))
  .handler(async (_req, { ctx, params }) => personalizeExercise(ctx.actor.userId, params.orgId, params.exerciseId));
