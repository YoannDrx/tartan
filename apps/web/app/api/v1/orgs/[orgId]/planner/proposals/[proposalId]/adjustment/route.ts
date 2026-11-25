import { decidePlannerAdjustmentInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { decidePlannerAdjustment } from "@/server/ai/proposal.service";
import { plannerProposalParams } from "../../../../../../_params";
export const POST = authRoute
  .params(plannerProposalParams)
  .body(decidePlannerAdjustmentInput)
  .handler(async (_request, { ctx, params, body }) =>
    decidePlannerAdjustment(ctx.actor.userId, params.orgId, params.proposalId, body),
  );
