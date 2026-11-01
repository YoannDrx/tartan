import { uuid } from "@tartan/contracts";
import { z } from "zod";
import { authRoute } from "@/lib/zod-route";
import { getAthleteFile } from "@/server/athlete.service";

export const GET = authRoute
  .params(z.object({ orgId: uuid, athleteId: uuid }))
  .handler(async (_req, { ctx, params }) => getAthleteFile(ctx.actor.userId, params.orgId, params.athleteId));
