import { checkInInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { clientCheckIn } from "@/server/releases.service";

export const POST = authRoute.body(checkInInput).handler(async (_req, { ctx, body }) => {
  await clientCheckIn(ctx.actor.userId, body);
  return { ok: true as const };
});
