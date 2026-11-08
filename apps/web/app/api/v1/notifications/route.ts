import { notificationsQuery } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { listNotifications } from "@/server/notify.service";

export const GET = authRoute
  .query(notificationsQuery)
  .handler(async (_req, { ctx, query }) => listNotifications(ctx.actor.userId, query));
