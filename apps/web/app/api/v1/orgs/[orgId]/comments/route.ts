import { commentEntity, commentInput, uuid } from "@tartan/contracts";
import { z } from "zod";
import { authRoute } from "@/lib/zod-route";
import { addComment, listComments } from "@/server/comm.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .query(z.object({ entityType: commentEntity, entityId: uuid }))
  .handler(async (_req, { ctx, params, query }) =>
    listComments(ctx.actor.userId, params.orgId, query.entityType, query.entityId),
  );

export const POST = authRoute
  .params(orgParams)
  .body(commentInput)
  .handler(async (_req, { ctx, params, body }) => addComment(ctx.actor.userId, params.orgId, body));
