import { authRoute } from "@/lib/zod-route";
import { resendParentalConsent } from "@/server/consent.service";
import { orgParams } from "../../../../_params";

export const POST = authRoute.params(orgParams).handler(async (_req, { ctx, params }) => {
  await resendParentalConsent(ctx.actor.userId, params.orgId);
  return { ok: true as const };
});
