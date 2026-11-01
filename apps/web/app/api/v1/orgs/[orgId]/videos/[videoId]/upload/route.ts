import { authRoute } from "@/lib/zod-route";
import { renewVideoUpload } from "@/server/video.service";
import { videoParams } from "../../../../../_params";

export const POST = authRoute
  .params(videoParams)
  .handler(async (_req, { ctx, params }) => renewVideoUpload(ctx.actor.userId, params.orgId, params.videoId));
