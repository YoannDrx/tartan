import { confirmPrescriptionRefresh } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { previewPrescriptionRefresh, refreshPublishedLoads } from "@/server/session.service";
import { sessionParams } from "../../../../../_params";

export const GET = authRoute
  .params(sessionParams)
  .handler(async (_req, { ctx, params }) =>
    previewPrescriptionRefresh(ctx.actor.userId, params.orgId, params.sessionId),
  );
export const POST = authRoute
  .params(sessionParams)
  .body(confirmPrescriptionRefresh)
  .handler(async (_req, { ctx, params, body }) =>
    refreshPublishedLoads(ctx.actor.userId, params.orgId, params.sessionId, body),
  );
