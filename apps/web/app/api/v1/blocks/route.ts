import { blockUserInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { blockUser, unblockUser } from "@/server/comm.service";

export const POST = authRoute.body(blockUserInput).handler(async (_req, { ctx, body }) => {
  await blockUser(ctx.actor.userId, body.userId);
  return { ok: true as const };
});

export const DELETE = authRoute.body(blockUserInput).handler(async (_req, { ctx, body }) => {
  await unblockUser(ctx.actor.userId, body.userId);
  return { ok: true as const };
});
