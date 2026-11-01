import { announcementInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { listAnnouncements, publishAnnouncement } from "@/server/comm.service";
import { orgParams } from "../../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => listAnnouncements(ctx.actor.userId, params.orgId));

export const POST = authRoute
  .params(orgParams)
  .body(announcementInput)
  .handler(async (_req, { ctx, params, body }) => publishAnnouncement(ctx.actor.userId, params.orgId, body));
