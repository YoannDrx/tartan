import { consentInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { getUserConsents, setConsent } from "@/server/consent.service";

export const GET = authRoute.handler(async (_req, { ctx }) => getUserConsents(ctx.actor.userId));

export const PUT = authRoute.body(consentInput).handler(async (_req, { ctx, body }) => {
  await setConsent(ctx.actor.userId, body.kind, body.granted);
  return getUserConsents(ctx.actor.userId);
});
