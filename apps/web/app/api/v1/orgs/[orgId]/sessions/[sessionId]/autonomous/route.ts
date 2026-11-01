import { authRoute } from "@/lib/zod-route";
import { generateAutonomousVersion } from "@/server/session.service";
import { sessionParams } from "../../../../../_params";

export const POST = authRoute.params(sessionParams).handler(async (_req, { ctx, params }) => {
  await generateAutonomousVersion(ctx.actor.userId, params.orgId, params.sessionId);
  return { ok: true as const };
});
