import { uuid } from "@tartan/contracts";
import { z } from "zod";
import { authRoute } from "@/lib/zod-route";
import { getBarSheet } from "@/server/video.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .query(z.object({ athleteId: uuid, scheduledSessionId: uuid.optional(), competitionId: uuid.optional() }))
  .handler(async (_req, { ctx, params, query }) => getBarSheet(ctx.actor.userId, params.orgId, query));
