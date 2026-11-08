import { preferencesInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { getMe, updatePreferences } from "@/server/me.service";

export const PATCH = authRoute.body(preferencesInput).handler(async (_req, { ctx, body }) => {
  await updatePreferences(ctx.actor.userId, body);
  return getMe(ctx.actor.userId);
});
