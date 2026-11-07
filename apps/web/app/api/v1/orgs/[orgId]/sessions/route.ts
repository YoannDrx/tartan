import { saveScheduledSessionInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { saveScheduledSession } from "@/server/session.service";
import { orgParams } from "../../../_params";

export const POST = authRoute
  .params(orgParams)
  .body(saveScheduledSessionInput.omit({ id: true, expectedVersion: true }).strict())
  .handler(async (_req, { ctx, params, body }) => saveScheduledSession(ctx.actor.userId, params.orgId, body));
