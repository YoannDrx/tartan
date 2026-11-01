import { profileInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { deleteAccount } from "@/server/account.service";
import { getMe, updateProfile } from "@/server/me.service";

export const GET = authRoute.handler(async (_req, { ctx }) => getMe(ctx.actor.userId));

export const PATCH = authRoute.body(profileInput).handler(async (_req, { ctx, body }) => {
  await updateProfile(ctx.actor.userId, body);
  return getMe(ctx.actor.userId);
});

export const DELETE = authRoute.handler(async (_req, { ctx }) => {
  await deleteAccount(ctx.actor.userId);
  return { ok: true as const };
});
