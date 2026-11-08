import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/zod-route";
import { getActorFrom } from "@/lib/session";
import { invalid, unauthorized } from "@/lib/errors";
import { requirePlannerTranscriptionAccess, transcribePlannerAudio } from "@/server/ai/transcription.service";
import { readPlannerUpload } from "@/server/ai/upload";
import { orgParams } from "../../../../_params";
export const maxDuration = 120;
// Le wrapper JSON lit le multipart avant ses middlewares. Ce flux borné doit
// authentifier et autoriser l’espace avant toute lecture ou analyse du corps.
export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  try {
    const actor = await getActorFrom(request.headers);
    if (!actor) throw unauthorized();
    const parsed = orgParams.safeParse(await context.params);
    if (!parsed.success) throw invalid();
    await requirePlannerTranscriptionAccess(actor.userId, parsed.data.orgId);
    const upload = await readPlannerUpload(request);
    return NextResponse.json(
      await transcribePlannerAudio(actor.userId, parsed.data.orgId, upload.metadata, upload.bytes),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
