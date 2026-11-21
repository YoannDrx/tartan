import { exerciseListInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { createExerciseList, listExerciseLists } from "@/server/exercise-list.service";
import { orgParams } from "../../../_params";

// Les listes du coach et celles que les autres coachs de l'espace partagent.
export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => listExerciseLists(ctx.actor.userId, params.orgId));

export const POST = authRoute
  .params(orgParams)
  .body(exerciseListInput)
  .handler(async (_req, { ctx, params, body }) => createExerciseList(ctx.actor.userId, params.orgId, body));
