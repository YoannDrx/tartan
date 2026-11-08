import { NextResponse } from "next/server";
import { authRoute } from "@/lib/zod-route";
import { getPlannerTranscription } from "@/server/ai/transcription.service";
import { plannerTranscriptionParams } from "../../../../../_params";
export const GET = authRoute
  .params(plannerTranscriptionParams)
  .handler(async (_request, { ctx, params }) =>
    NextResponse.json(await getPlannerTranscription(ctx.actor.userId, params.orgId, params.transcriptionId), {
      headers: { "Cache-Control": "private, no-store" },
    }),
  );
