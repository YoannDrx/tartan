import { createVideoInput, uuid } from "@tartan/contracts";
import { z } from "zod";
import { authRoute } from "@/lib/zod-route";
import { createVideoUpload, listVideos } from "@/server/video.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .query(z.object({ athleteId: uuid.optional(), exerciseId: uuid.optional() }))
  .handler(async (_req, { ctx, params, query }) => listVideos(ctx.actor.userId, params.orgId, query));

export const POST = authRoute
  .params(orgParams)
  .body(createVideoInput)
  .handler(async (_req, { ctx, params, body }) => createVideoUpload(ctx.actor.userId, params.orgId, body));
