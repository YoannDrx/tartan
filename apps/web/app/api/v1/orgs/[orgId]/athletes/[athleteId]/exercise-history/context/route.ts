import { uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { getAthleteHistoryContext } from "@/server/exercise-history.service";
import { orgParams } from "../../../../../../_params";

export const GET = authRoute
  .params(orgParams.extend({ athleteId: uuid }))
  .handler(async (_req, { ctx, params }) => getAthleteHistoryContext(ctx.actor.userId, params.orgId, params.athleteId));
