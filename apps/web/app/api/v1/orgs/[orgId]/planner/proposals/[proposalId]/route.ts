import { NextResponse } from "next/server";
import { authRoute } from "@/lib/zod-route";
import { getPlannerProposal } from "@/server/ai/proposal.service";
import { plannerProposalParams } from "../../../../../_params";

export const GET = authRoute
  .params(plannerProposalParams)
  .handler(async (_request, { ctx, params }) =>
    NextResponse.json(await getPlannerProposal(ctx.actor.userId, params.orgId, params.proposalId), {
      headers: { "Cache-Control": "private, no-store" },
    }),
  );
