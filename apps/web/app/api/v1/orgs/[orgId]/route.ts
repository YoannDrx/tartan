import { organizationUpdateInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { getOrganization, updateOrganization } from "@/server/org.service";
import { orgParams } from "../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => getOrganization(ctx.actor.userId, params.orgId));

export const PATCH = authRoute
  .params(orgParams)
  .body(organizationUpdateInput)
  .handler(async (_req, { ctx, params, body }) => {
    await updateOrganization(ctx.actor.userId, params.orgId, body);
    return getOrganization(ctx.actor.userId, params.orgId);
  });
