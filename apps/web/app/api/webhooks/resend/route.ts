import { NextResponse } from "next/server";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { suppressEmail } from "@/server/email-suppression.service";

// Resend peut servir plusieurs applications : seule l'adresse exacte de Tartan nous concerne.
const senderAddress = (value: unknown): string | undefined => {
  if (typeof value !== "string" || /[\r\n]/.test(value)) return undefined;
  const address = value.trim().match(/^(?:[^<>]*<([^<>]+)>|([^<>]+))$/);
  const candidate = (address?.[1] ?? address?.[2])?.trim();
  return candidate && /^[^\s@<>,;]+@[^\s@<>,;]+$/.test(candidate) ? candidate.toLowerCase() : undefined;
};

export async function POST(request: Request) {
  const { RESEND_API_KEY, RESEND_WEBHOOK_SECRET, RESEND_PREVIOUS_SENDERS, EMAIL_FROM } = env();
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
    const sender = senderAddress(event.data.from);
    const allowedSenders = [EMAIL_FROM, ...(RESEND_PREVIOUS_SENDERS?.split(",") ?? [])].map(senderAddress);
    if (!sender || !allowedSenders.includes(sender)) return NextResponse.json({ received: true });
    // Une boîte temporairement pleine n'est pas une adresse définitivement invalide.
    if (event.type === "email.bounced" && event.data.bounce.type !== "Permanent")
      return NextResponse.json({ received: true });
    const reason =
      event.type === "email.bounced" ? "bounce" : event.type === "email.complained" ? "complaint" : "suppressed";
    for (const email of event.data.to) await suppressEmail(email, reason);
  }
  return NextResponse.json({ received: true });
}
