import { uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { getExerciseSheet } from "@/server/exercise.service";
import { orgParams } from "../../../../_params";

// La fiche complète : guide concis, étoile et listes du coach, variantes.
export const GET = authRoute
  .params(orgParams.extend({ exerciseId: uuid }))
  .handler(async (_req, { ctx, params }) => getExerciseSheet(ctx.actor.userId, params.orgId, params.exerciseId));
