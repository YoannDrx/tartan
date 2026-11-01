import { authRoute } from "@/lib/zod-route";
import { listNotifications } from "@/server/notify.service";

export const GET = authRoute.handler(async (_req, { ctx }) => listNotifications(ctx.actor.userId));
