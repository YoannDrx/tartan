import { NextResponse } from "next/server";
import { plannerProposalListQuery } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { listPlannerProposals } from "@/server/ai/proposal.service";
import { orgParams } from "../../../../_params";

export const GET = authRoute
  .params(orgParams)
  .query(plannerProposalListQuery)
  .handler(async (_request, { ctx, params, query }) =>
    NextResponse.json(await listPlannerProposals(ctx.actor.userId, params.orgId, query), {
      headers: { "Cache-Control": "private, no-store" },
    }),
  );
