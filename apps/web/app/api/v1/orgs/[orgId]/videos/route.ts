import { createVideoInput, uuid, videoStatus } from "@tartan/contracts";
import { z } from "zod";
import { authRoute } from "@/lib/zod-route";
import { createVideoUpload, listVideos, listVideoPage } from "@/server/video.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .query(
    z.object({
      athleteId: uuid.optional(),
      exerciseId: uuid.optional(),
      sessionId: uuid.optional(),
      status: videoStatus.optional(),
      cursor: uuid.optional(),
      review: z.literal("pending").optional(),
      page: z.literal("1").optional(),
    }),
  )
  .handler(async (_req, { ctx, params, query }) => {
    const filter = { ...query, needsReview: query.review === "pending" };
    return query.page
      ? listVideoPage(ctx.actor.userId, params.orgId, filter)
      : listVideos(ctx.actor.userId, params.orgId, filter);
  });

export const POST = authRoute
  .params(orgParams)
  .body(createVideoInput)
  .handler(async (_req, { ctx, params, body }) => createVideoUpload(ctx.actor.userId, params.orgId, body));
