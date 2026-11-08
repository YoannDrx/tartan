import { linkVideoExerciseInput, uuid } from "@tartan/contracts";
import { z } from "zod";
import { authRoute } from "@/lib/zod-route";
import { linkVideoExercise } from "@/server/video.service";

export const POST = authRoute
  .params(z.object({ orgId: uuid, videoId: uuid }))
  .body(linkVideoExerciseInput)
  .handler(async (_req, { ctx, params, body }) => {
    await linkVideoExercise(ctx.actor.userId, params.orgId, params.videoId, body.exerciseId);
    return { ok: true as const };
  });
