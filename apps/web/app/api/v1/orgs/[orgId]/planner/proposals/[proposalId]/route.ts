import { removePlannerProposalQuery, savePlannerReviewInput } from "@tartan/contracts";
import { NextResponse } from "next/server";
import { authRoute } from "@/lib/zod-route";
import { getPlannerProposal, removePlannerProposal, savePlannerReview } from "@/server/ai/proposal.service";
import { plannerProposalParams } from "../../../../../_params";

export const GET = authRoute.params(plannerProposalParams).handler(async (_request, { ctx, params }) =>
  NextResponse.json(await getPlannerProposal(ctx.actor.userId, params.orgId, params.proposalId), {
    headers: { "Cache-Control": "private, no-store" },
  }),
);

export const DELETE = authRoute
  .params(plannerProposalParams)
  .query(removePlannerProposalQuery)
  .handler(async (_request, { ctx, params, query }) =>
    removePlannerProposal(ctx.actor.userId, params.orgId, params.proposalId, query.expectedVersion),
  );

export const PATCH = authRoute
  .params(plannerProposalParams)
  .body(savePlannerReviewInput)
  .handler(async (_request, { ctx, params, body }) =>
    savePlannerReview(ctx.actor.userId, params.orgId, params.proposalId, body),
  );
