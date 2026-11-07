import { sessionLogInput, uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { getAthleteSessionForCoach, logSessionForAthlete } from "@/server/athlete-view.service";
import { sessionParams } from "../../../../../../../_params";

const params = sessionParams.extend({ athleteId: uuid });

export const GET = authRoute
  .params(params)
  .handler(async (_req, { ctx, params }) =>
    getAthleteSessionForCoach(ctx.actor.userId, params.orgId, params.sessionId, params.athleteId),
  );

export const POST = authRoute
  .params(params)
  .body(sessionLogInput)
  .handler(async (_req, { ctx, params, body }) =>
    logSessionForAthlete(ctx.actor.userId, params.orgId, params.sessionId, params.athleteId, body),
  );
