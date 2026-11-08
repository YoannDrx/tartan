import { uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { deleteTemplate } from "@/server/session.service";
import { orgParams } from "../../../../_params";

export const DELETE = authRoute
  .params(orgParams.extend({ templateId: uuid }))
  .handler(async (_req, { ctx, params }) => {
    await deleteTemplate(ctx.actor.userId, params.orgId, params.templateId);
    return { ok: true };
  });
