import { filmingNote } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { listFilming, saveFilming } from "@/server/exercise-filming.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler((_req, { ctx, params }) => listFilming(ctx.actor.userId, params.orgId));
export const PUT = authRoute
  .params(orgParams)
  .body(filmingNote)
  .handler((_req, { ctx, params, body }) => saveFilming(ctx.actor.userId, params.orgId, body));
