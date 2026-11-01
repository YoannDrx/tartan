import { exerciseInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { listExercises, saveExercise } from "@/server/exercise.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => listExercises(ctx.actor.userId, params.orgId));

// Création, ou modification si le corps porte l'identifiant de l'exercice.
export const POST = authRoute
  .params(orgParams)
  .body(exerciseInput)
  .handler(async (_req, { ctx, params, body }) => saveExercise(ctx.actor.userId, params.orgId, body));
