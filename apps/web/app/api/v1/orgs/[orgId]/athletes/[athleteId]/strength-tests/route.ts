import { strengthTestInput, uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { addStrengthTest } from "@/server/strength.service";
import { orgParams } from "../../../../../_params";

export const POST = authRoute
  .params(orgParams.extend({ athleteId: uuid }))
  .body(strengthTestInput.omit({ athleteId: true }).strict())
  .handler(async (_req, { ctx, params, body }) =>
    addStrengthTest(ctx.actor.userId, params.orgId, { ...body, athleteId: params.athleteId }),
  );
