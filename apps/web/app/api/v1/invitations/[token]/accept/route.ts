import { acceptInvitationInput } from "@tartan/contracts";
import { z } from "zod";
import { authRoute } from "@/lib/zod-route";
import { acceptInvitation } from "@/server/invitation.service";

export const POST = authRoute
  .params(z.object({ token: z.string().min(16).max(200) }))
  .body(acceptInvitationInput)
  .handler(async (_req, { ctx, params, body }) => acceptInvitation(ctx.actor, params.token, body));
