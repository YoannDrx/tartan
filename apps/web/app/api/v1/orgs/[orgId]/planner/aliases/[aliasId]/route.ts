import { NextResponse } from "next/server";
import { authRoute } from "@/lib/zod-route";
import { forgetExerciseTermAlias } from "@/server/ai/alias.service";
import { plannerAliasParams } from "../../../../../_params";

// Oublier un alias appris : le terme sera de nouveau cherché dans la bibliothèque.
export const DELETE = authRoute
  .params(plannerAliasParams)
  .handler(async (_request, { ctx, params }) =>
    NextResponse.json(await forgetExerciseTermAlias(ctx.actor.userId, params.orgId, params.aliasId), {
      headers: { "Cache-Control": "private, no-store" },
    }),
  );
