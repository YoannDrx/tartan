import { deviceInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { registerDevice, unregisterDevice } from "@/server/notify.service";

export const POST = authRoute.body(deviceInput).handler(async (_req, { ctx, body }) => {
  await registerDevice(ctx.actor.userId, body.pushToken, body.platform);
  return { ok: true as const };
});

// À la déconnexion : l'appareil ne reçoit plus rien pour ce compte.
export const DELETE = authRoute.body(deviceInput.pick({ pushToken: true })).handler(async (_req, { ctx, body }) => {
  await unregisterDevice(ctx.actor.userId, body.pushToken);
  return { ok: true as const };
});
