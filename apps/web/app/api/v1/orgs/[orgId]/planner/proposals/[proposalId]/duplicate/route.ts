import { duplicatePlannerProposalInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { duplicatePlannerProposal } from "@/server/ai/proposal.service";
import { plannerProposalParams } from "../../../../../../_params";
export const POST = authRoute
  .params(plannerProposalParams)
  .body(duplicatePlannerProposalInput)
  .handler(async (_request, { ctx, params, body }) =>
    duplicatePlannerProposal(ctx.actor.userId, params.orgId, params.proposalId, body),
  );
