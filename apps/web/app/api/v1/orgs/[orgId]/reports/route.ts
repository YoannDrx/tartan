import { reportContentInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { reportContent } from "@/server/comm.service";
import { orgParams } from "../../../_params";

export const POST = authRoute
  .params(orgParams)
  .body(reportContentInput)
  .handler(async (_req, { ctx, params, body }) => {
    await reportContent(ctx.actor.userId, params.orgId, body);
    return { ok: true as const };
  });
