import { onboardingPatch } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { getOnboarding, updateOnboarding } from "@/server/onboarding.service";
import { orgParams } from "../../../_params";

// Les premiers pas du membre connecté dans cet espace : chacun ne lit et n'écrit que les siens.
export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => getOnboarding(ctx.actor.userId, params.orgId));
export const PATCH = authRoute
  .params(orgParams)
  .body(onboardingPatch)
  .handler(async (_req, { ctx, params, body }) => updateOnboarding(ctx.actor.userId, params.orgId, body));
