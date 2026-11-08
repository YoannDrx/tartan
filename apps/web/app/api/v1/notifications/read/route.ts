import { markNotificationsInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { markNotificationsRead } from "@/server/notify.service";

export const POST = authRoute.body(markNotificationsInput).handler(async (_req, { ctx, body }) => {
  await markNotificationsRead(ctx.actor.userId, body);
  return { ok: true as const };
});
