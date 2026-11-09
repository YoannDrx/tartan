import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { handleMuxWebhook, MuxSignatureError } from "@/server/video.service";

export async function POST(request: Request) {
  const body = await request.text();
  try {
    await handleMuxWebhook(body, request.headers);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof MuxSignatureError) {
      log.warn("mux_webhook_rejected");
      return NextResponse.json({ message: "Signature invalide" }, { status: 400 });
    }
    // Panne de notre côté : un 500 pour que Mux renvoie l'événement.
    log.error("mux_webhook_failed");
    return NextResponse.json({ message: "Traitement impossible" }, { status: 500 });
  }
}
