import { checkInInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { recordBetaUse } from "@/server/beta-testers.service";
import { clientCheckIn } from "@/server/releases.service";

export const POST = authRoute.body(checkInInput).handler(async (_req, { ctx, body }) => {
  await clientCheckIn(ctx.actor.userId, body);
  const betaUpdate = body.beta ? await recordBetaUse(ctx.actor.userId, body, new Date()) : undefined;
  return { ok: true as const, ...(betaUpdate ? { betaUpdate } : {}) };
});
