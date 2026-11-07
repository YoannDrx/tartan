import { saveScheduledSessionInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { deleteSession, getSessionForEdit, saveScheduledSession } from "@/server/session.service";
import { sessionParams } from "../../../../_params";

export const GET = authRoute
  .params(sessionParams)
  .handler(async (_req, { ctx, params }) => getSessionForEdit(ctx.actor.userId, params.orgId, params.sessionId));

export const PUT = authRoute
  .params(sessionParams)
  .body(saveScheduledSessionInput.omit({ id: true }).required({ expectedVersion: true }).strict())
  .handler(async (_req, { ctx, params, body }) =>
    saveScheduledSession(ctx.actor.userId, params.orgId, { ...body, id: params.sessionId }),
  );

export const DELETE = authRoute.params(sessionParams).handler(async (_req, { ctx, params }) => {
  await deleteSession(ctx.actor.userId, params.orgId, params.sessionId);
  return { ok: true };
});
