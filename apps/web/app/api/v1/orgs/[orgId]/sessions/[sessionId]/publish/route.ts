import { authRoute } from "@/lib/zod-route";
import { z } from "zod";
import { publishSession } from "@/server/session.service";
import { sessionParams } from "../../../../../_params";

export const POST = authRoute
  .params(sessionParams)
  .body(z.object({ expectedVersion: z.number().int().min(1) }).strict())
  .handler(async (_req, { ctx, params, body }) =>
    publishSession(ctx.actor.userId, params.orgId, params.sessionId, undefined, body.expectedVersion),
  );
