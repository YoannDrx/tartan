import { resolvePlannerExerciseInput } from "@tartan/contracts";
import { NextResponse } from "next/server";
import { authRoute } from "@/lib/zod-route";
import { resolvePlannerExercise } from "@/server/ai/proposal.service";
import { plannerProposalParams } from "../../../../../../_params";

export const POST = authRoute
  .params(plannerProposalParams)
  .body(resolvePlannerExerciseInput)
  .handler(async (_request, { ctx, params, body }) =>
    NextResponse.json(await resolvePlannerExercise(ctx.actor.userId, params.orgId, params.proposalId, body), {
      headers: { "Cache-Control": "private, no-store" },
    }),
  );
