import { z } from "zod";
import { authRoute } from "@/lib/zod-route";
import { duplicatePlannerDraft } from "@/server/session.service";
import { sessionParams } from "../../../../../_params";
export const POST = authRoute
  .params(sessionParams)
  .body(z.object({ operationId: z.uuid(), expectedVersion: z.number().int().positive() }).strict())
  .handler(async (_request, { ctx, params, body }) =>
    duplicatePlannerDraft(ctx.actor.userId, params.orgId, params.sessionId, body.operationId, body.expectedVersion),
  );
