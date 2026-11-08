import { previewPlannerLoadsInput } from "@tartan/contracts";
import { NextResponse } from "next/server";
import { authRoute } from "@/lib/zod-route";
import { previewPlannerLoads } from "@/server/ai/proposal.service";
import { plannerProposalParams } from "../../../../../../_params";

export const POST = authRoute
  .params(plannerProposalParams)
  .body(previewPlannerLoadsInput)
  .handler(async (_request, { ctx, params, body }) =>
    NextResponse.json(await previewPlannerLoads(ctx.actor.userId, params.orgId, params.proposalId, body), {
      headers: { "Cache-Control": "private, no-store" },
    }),
  );
