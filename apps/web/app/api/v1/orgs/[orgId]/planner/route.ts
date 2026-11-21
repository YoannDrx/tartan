import { createPlannerProposalInput } from "@tartan/contracts";
import { NextResponse } from "next/server";
import { authRoute } from "@/lib/zod-route";
import { createPlannerProposal } from "@/server/ai/proposal.service";
import { plannerEventStream, wantsPlannerStream } from "@/server/ai/stream";
import { orgParams } from "../../../_params";

export const maxDuration = 120;
export const POST = authRoute
  .params(orgParams)
  .body(createPlannerProposalInput)
  .handler(async (request, { ctx, params, body }) =>
    // Le web demande la réponse diffusée ; l'app native installée garde le JSON d'une seule pièce.
    wantsPlannerStream(request)
      ? plannerEventStream((hooks) => createPlannerProposal(ctx.actor.userId, params.orgId, body, hooks))
      : NextResponse.json(await createPlannerProposal(ctx.actor.userId, params.orgId, body), {
          headers: { "Cache-Control": "private, no-store" },
        }),
  );
