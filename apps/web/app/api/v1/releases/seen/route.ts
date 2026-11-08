import { releaseSeenInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { markReleaseSeen } from "@/server/releases.service";

export const POST = authRoute.body(releaseSeenInput).handler(async (_req, { ctx, body }) => {
  await markReleaseSeen(ctx.actor.userId, body.releaseId);
  return { ok: true as const };
});
