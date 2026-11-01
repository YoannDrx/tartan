import { shareVideoInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { shareVideo } from "@/server/video.service";
import { videoParams } from "../../../../../_params";

export const POST = authRoute
  .params(videoParams)
  .body(shareVideoInput)
  .handler(async (_req, { ctx, params, body }) => {
    await shareVideo(ctx.actor.userId, params.orgId, params.videoId, body);
    return { ok: true as const };
  });
