import { clarifyPlannerProposalInput } from "@tartan/contracts";
import { NextResponse } from "next/server";
import { authRoute } from "@/lib/zod-route";
import { clarifyPlannerProposal } from "@/server/ai/proposal.service";
import { plannerEventStream, wantsPlannerStream } from "@/server/ai/stream";
import { plannerProposalParams } from "../../../../../../_params";

export const maxDuration = 120;
export const POST = authRoute
  .params(plannerProposalParams)
  .body(clarifyPlannerProposalInput)
  .handler(async (request, { ctx, params, body }) =>
    wantsPlannerStream(request)
      ? plannerEventStream((hooks) =>
          clarifyPlannerProposal(ctx.actor.userId, params.orgId, params.proposalId, body, hooks),
        )
      : NextResponse.json(await clarifyPlannerProposal(ctx.actor.userId, params.orgId, params.proposalId, body), {
          headers: { "Cache-Control": "private, no-store" },
        }),
  );
