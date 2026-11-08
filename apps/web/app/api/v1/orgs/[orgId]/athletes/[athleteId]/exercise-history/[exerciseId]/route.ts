import { exerciseHistoryQuery, uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { getAthleteExerciseHistory } from "@/server/exercise-history.service";
import { orgParams } from "../../../../../../_params";

export const GET = authRoute
  .params(orgParams.extend({ athleteId: uuid, exerciseId: uuid }))
  .query(exerciseHistoryQuery)
  .handler(async (_req, { ctx, params, query }) =>
    getAthleteExerciseHistory(ctx.actor.userId, params.orgId, params.athleteId, params.exerciseId, query),
  );
