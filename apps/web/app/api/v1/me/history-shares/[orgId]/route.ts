import { authRoute } from "@/lib/zod-route";
import { revokeHistoryShare } from "@/server/history-share.service";
import { orgParams } from "../../../_params";

// Retirer le partage vers cet espace : effet immédiat. Sans partage, rien ne change.
export const DELETE = authRoute.params(orgParams).handler(async (_req, { ctx, params }) => {
  await revokeHistoryShare(ctx.actor.userId, params.orgId);
  return { ok: true };
});
