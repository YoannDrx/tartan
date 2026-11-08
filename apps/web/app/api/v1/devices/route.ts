import { deviceInput } from "@tartan/contracts";
import { authRoute, readJsonBody } from "@/lib/zod-route";
import { registerDevice, unregisterDevice } from "@/server/notify.service";

export const POST = authRoute.body(deviceInput).handler(async (_req, { ctx, body }) => {
  await registerDevice(ctx.actor.userId, body.pushToken, body.platform);
  return { ok: true as const };
});

// À la déconnexion : l'appareil ne reçoit plus rien pour ce compte.
export const DELETE = authRoute.handler(async (req, { ctx }) => {
  const body = await readJsonBody(req, deviceInput.pick({ pushToken: true }).strict());
  await unregisterDevice(ctx.actor.userId, body.pushToken);
  return { ok: true as const };
});
