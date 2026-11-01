import { createInvitationInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { createInvitation, listInvitations } from "@/server/invitation.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => listInvitations(ctx.actor.userId, params.orgId));

export const POST = authRoute
  .params(orgParams)
  .body(createInvitationInput)
  .handler(async (_req, { ctx, params, body }) => createInvitation(ctx.actor.userId, params.orgId, body));
