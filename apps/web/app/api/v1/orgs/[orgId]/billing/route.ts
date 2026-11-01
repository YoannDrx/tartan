import { authRoute } from "@/lib/zod-route";
import { getBillingOverview } from "@/server/billing.service";
import { orgParams } from "../../../_params";

export const GET = authRoute.params(orgParams).handler(async (_req, { ctx, params }) => getBillingOverview(ctx.actor.userId, params.orgId));
