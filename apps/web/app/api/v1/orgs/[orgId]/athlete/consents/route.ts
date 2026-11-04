import { athleteConsentInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { getUserConsents, setAthleteConsent } from "@/server/consent.service";
import { orgParams } from "../../../../_params";

export const PUT = authRoute
  .params(orgParams)
  .body(athleteConsentInput)
  .handler(async (_req, { ctx, params, body }) => {
    await setAthleteConsent(ctx.actor.userId, params.orgId, body.kind, body.granted);
    return getUserConsents(ctx.actor.userId);
  });
