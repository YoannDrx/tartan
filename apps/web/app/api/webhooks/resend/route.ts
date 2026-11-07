import { NextResponse } from "next/server";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { suppressEmail } from "@/server/email-suppression.service";

export async function POST(request: Request) {
  const { RESEND_API_KEY, RESEND_WEBHOOK_SECRET } = env();
  if (!RESEND_API_KEY || !RESEND_WEBHOOK_SECRET) return new NextResponse(null, { status: 503 });
  const payload = await request.text();
  if (payload.length > 65_536) return new NextResponse(null, { status: 413 });
  let event;
  try {
    event = new Resend(RESEND_API_KEY).webhooks.verify({
      payload,
      webhookSecret: RESEND_WEBHOOK_SECRET,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
    });
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (event.type === "email.bounced" || event.type === "email.complained" || event.type === "email.suppressed") {
    // Une boîte temporairement pleine n'est pas une adresse définitivement invalide.
    if (event.type === "email.bounced" && event.data.bounce.type !== "Permanent")
      return NextResponse.json({ received: true });
    const reason =
      event.type === "email.bounced" ? "bounce" : event.type === "email.complained" ? "complaint" : "suppressed";
    for (const email of event.data.to) await suppressEmail(email, reason);
  }
  return NextResponse.json({ received: true });
}
