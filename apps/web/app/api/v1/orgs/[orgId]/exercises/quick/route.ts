import { quickExerciseInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { quickCreateExercise } from "@/server/exercise.service";
import { orgParams } from "../../../../_params";

// Création rapide : un nom suffit. Rend la fiche créée, ou celle qui portait déjà ce nom (`created: false`).
export const POST = authRoute
  .params(orgParams)
  .body(quickExerciseInput)
  .handler(async (_req, { ctx, params, body }) => quickCreateExercise(ctx.actor.userId, params.orgId, body));
