import { uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { listAthleteHistoryExercises } from "@/server/exercise-history.service";
import { orgParams } from "../../../../../_params";

export const GET = authRoute
  .params(orgParams.extend({ athleteId: uuid }))
  .handler(async (_req, { ctx, params }) =>
    listAthleteHistoryExercises(ctx.actor.userId, params.orgId, params.athleteId),
  );
