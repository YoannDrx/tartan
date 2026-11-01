import { jumpAttemptInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { addJumpAttempt } from "@/server/video.service";
import { orgParams } from "../../../_params";

export const POST = authRoute
  .params(orgParams)
  .body(jumpAttemptInput)
  .handler(async (_req, { ctx, params, body }) => addJumpAttempt(ctx.actor.userId, params.orgId, body));
