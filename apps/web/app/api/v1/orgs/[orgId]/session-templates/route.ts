import { sessionDraft } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { saveTemplate } from "@/server/session.service";
import { orgParams } from "../../../_params";

export const POST = authRoute
  .params(orgParams)
  .body(sessionDraft)
  .handler(async (_req, { ctx, params, body }) => saveTemplate(ctx.actor.userId, params.orgId, body));
