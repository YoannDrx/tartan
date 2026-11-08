import { clarifyPlannerProposalInput } from "@tartan/contracts";
import { NextResponse } from "next/server";
import { authRoute } from "@/lib/zod-route";
import { clarifyPlannerProposal } from "@/server/ai/proposal.service";
import { plannerProposalParams } from "../../../../../../_params";

export const maxDuration = 120;
export const POST = authRoute
  .params(plannerProposalParams)
  .body(clarifyPlannerProposalInput)
  .handler(async (_request, { ctx, params, body }) =>
    NextResponse.json(await clarifyPlannerProposal(ctx.actor.userId, params.orgId, params.proposalId, body), {
      headers: { "Cache-Control": "private, no-store" },
    }),
  );
