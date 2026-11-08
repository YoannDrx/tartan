import { confirmPlannerProposalInput } from "@tartan/contracts";
import { NextResponse } from "next/server";
import { authRoute } from "@/lib/zod-route";
import { confirmPlannerProposal } from "@/server/ai/proposal.service";
import { plannerProposalParams } from "../../../../../../_params";

export const POST = authRoute
  .params(plannerProposalParams)
  .body(confirmPlannerProposalInput)
  .handler(async (_request, { ctx, params, body }) =>
    NextResponse.json(await confirmPlannerProposal(ctx.actor.userId, params.orgId, params.proposalId, body), {
      headers: { "Cache-Control": "private, no-store" },
    }),
  );
