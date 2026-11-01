import { uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { deleteAnnotation } from "@/server/video.service";
import { videoParams } from "../../../../../../_params";

export const DELETE = authRoute
  .params(videoParams.extend({ annotationId: uuid }))
  .handler(async (_req, { ctx, params }) => {
    await deleteAnnotation(ctx.actor.userId, params.orgId, params.annotationId);
    return { ok: true as const };
  });
