import { preparePlannerDraftsInput } from "@tartan/contracts";
import { NextResponse } from "next/server";
import { authRoute } from "@/lib/zod-route";
import { preparePlannerDrafts } from "@/server/ai/proposal.service";
import { plannerProposalParams } from "../../../../../../_params";

export const POST = authRoute
  .params(plannerProposalParams)
  .body(preparePlannerDraftsInput)
  .handler(async (_request, { ctx, params, body }) =>
    NextResponse.json(
      await preparePlannerDrafts(ctx.actor.userId, params.orgId, params.proposalId, body.expectedVersion),
      { headers: { "Cache-Control": "private, no-store" } },
    ),
  );
