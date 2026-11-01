import { deviceInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { registerDevice } from "@/server/notify.service";

export const POST = authRoute.body(deviceInput).handler(async (_req, { ctx, body }) => {
  await registerDevice(ctx.actor.userId, body.pushToken, body.platform);
  return { ok: true as const };
});
