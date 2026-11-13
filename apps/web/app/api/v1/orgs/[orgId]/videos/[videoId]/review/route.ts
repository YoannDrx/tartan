import { authRoute } from "@/lib/zod-route";
import { markVideoReviewed } from "@/server/video.service";
import { videoParams } from "../../../../../_params";

export const POST = authRoute.params(videoParams).handler(async (_req, { ctx, params }) => {
  await markVideoReviewed(ctx.actor.userId, params.orgId, params.videoId);
  return { ok: true as const };
});
