import { authRoute } from "@/lib/zod-route";
import { deleteVideo, getVideo } from "@/server/video.service";
import { videoParams } from "../../../../_params";

export const GET = authRoute
  .params(videoParams)
  .handler(async (_req, { ctx, params }) => getVideo(ctx.actor.userId, params.orgId, params.videoId));

export const DELETE = authRoute.params(videoParams).handler(async (_req, { ctx, params }) => {
  await deleteVideo(ctx.actor.userId, params.orgId, params.videoId);
  return { ok: true as const };
});
