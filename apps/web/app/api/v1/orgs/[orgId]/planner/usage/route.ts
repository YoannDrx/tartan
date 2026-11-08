import { NextResponse } from "next/server";
import { authRoute } from "@/lib/zod-route";
import { getPlannerUsage } from "@/server/ai/usage.service";
import { orgParams } from "../../../../_params";

export const GET = authRoute
  .params(orgParams)
  .handler(async (_request, { ctx, params }) =>
    NextResponse.json(await getPlannerUsage(ctx.actor.userId, params.orgId), {
      headers: { "Cache-Control": "private, no-store" },
    }),
  );
