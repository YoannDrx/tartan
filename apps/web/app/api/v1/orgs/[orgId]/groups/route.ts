import { requireOrgMember } from "@/server/access";
import { listGroups } from "@/server/org.service";
import { authRoute } from "@/lib/zod-route";
import { orgParams } from "../../../_params";

export const GET = authRoute.params(orgParams).handler(async (_req, { ctx, params }) => {
  const access = await requireOrgMember(ctx.actor.userId, params.orgId, "viewTracking");
  return listGroups(access);
});
