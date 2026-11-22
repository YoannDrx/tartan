import { NextResponse } from "next/server";
import { authRoute } from "@/lib/zod-route";
import { listExerciseTermAliases } from "@/server/ai/alias.service";
import { orgParams } from "../../../../_params";

// Les alias appris de l'espace : le terme dit par un coach, et la fiche qu'il a choisie pour lui.
export const GET = authRoute
  .params(orgParams)
  .handler(async (_request, { ctx, params }) =>
    NextResponse.json(await listExerciseTermAliases(ctx.actor.userId, params.orgId), {
      headers: { "Cache-Control": "private, no-store" },
    }),
  );
