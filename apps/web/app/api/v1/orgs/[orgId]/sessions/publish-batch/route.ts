import { publishSessionsInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { publishSessions } from "@/server/session.service";
import { orgParams } from "../../../../_params";
export const POST = authRoute
  .params(orgParams)
  .body(publishSessionsInput)
  .handler(async (_req, { ctx, params, body }) => publishSessions(ctx.actor.userId, params.orgId, body));
