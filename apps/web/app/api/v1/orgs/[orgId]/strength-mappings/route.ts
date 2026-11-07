import { legacyStrengthMappingInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { confirmStrengthMapping, strengthMappingReport } from "@/server/strength.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => strengthMappingReport(ctx.actor.userId, params.orgId));
export const POST = authRoute
  .params(orgParams)
  .body(legacyStrengthMappingInput)
  .handler(async (_req, { ctx, params, body }) => confirmStrengthMapping(ctx.actor.userId, params.orgId, body));
