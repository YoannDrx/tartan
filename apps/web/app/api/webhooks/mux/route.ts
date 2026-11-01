import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { handleMuxWebhook } from "@/server/video.service";

export async function POST(request: Request) {
  const body = await request.text();
  try {
    await handleMuxWebhook(body, request.headers);
    return NextResponse.json({ ok: true });
  } catch {
    log.warn("mux_webhook_rejected");
    return NextResponse.json({ message: "Signature invalide" }, { status: 400 });
  }
}
