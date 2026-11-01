import { rollCallInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { takeRollCall } from "@/server/tracking.service";
import { sessionParams } from "../../../../../_params";

export const POST = authRoute
  .params(sessionParams)
  .body(rollCallInput)
  .handler(async (_req, { ctx, params, body }) => takeRollCall(ctx.actor.userId, params.orgId, params.sessionId, body));
