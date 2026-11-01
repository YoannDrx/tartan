import { uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { groupInvitationLink } from "@/server/invitation.service";
import { orgParams } from "../../../../../_params";

export const POST = authRoute.params(orgParams.extend({ groupId: uuid })).handler(async (_req, { ctx, params }) => {
  const { id, link } = await groupInvitationLink(ctx.actor.userId, params.orgId, params.groupId);
  return { id, link };
});
