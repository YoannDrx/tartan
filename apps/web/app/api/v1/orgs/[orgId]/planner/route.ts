import { createPlannerProposalInput } from "@tartan/contracts";
import { NextResponse } from "next/server";
import { authRoute } from "@/lib/zod-route";
import { createPlannerProposal } from "@/server/ai/proposal.service";
import { orgParams } from "../../../_params";

export const maxDuration = 120;
export const POST = authRoute
  .params(orgParams)
  .body(createPlannerProposalInput)
  .handler(async (_request, { ctx, params, body }) =>
    NextResponse.json(await createPlannerProposal(ctx.actor.userId, params.orgId, body), {
      headers: { "Cache-Control": "private, no-store" },
    }),
  );
