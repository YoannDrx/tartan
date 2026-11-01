import { attendanceInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { setMyAttendance } from "@/server/athlete-view.service";
import { sessionParams } from "../../../../../_params";

export const POST = authRoute
  .params(sessionParams)
  .body(attendanceInput)
  .handler(async (_req, { ctx, params, body }) =>
    setMyAttendance(ctx.actor.userId, params.orgId, params.sessionId, body.status),
  );
