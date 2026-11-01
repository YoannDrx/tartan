import { authRoute } from "@/lib/zod-route";
import { exportMyData } from "@/server/export.service";

export const GET = authRoute.handler(async (_req, { ctx }) => exportMyData(ctx.actor.userId));
