import { remindInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { remindAthletes } from "@/server/tracking.service";
import { sessionParams } from "../../../../../_params";

export const POST = authRoute
  .params(sessionParams)
  .body(remindInput)
  .handler(async (_req, { ctx, params, body }) =>
    remindAthletes(ctx.actor.userId, params.orgId, params.sessionId, body.athleteIds),
  );
