import { annotationInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { addAnnotation } from "@/server/video.service";
import { videoParams } from "../../../../../_params";

export const POST = authRoute
  .params(videoParams)
  .body(annotationInput)
  .handler(async (_req, { ctx, params, body }) => addAnnotation(ctx.actor.userId, params.orgId, params.videoId, body));
