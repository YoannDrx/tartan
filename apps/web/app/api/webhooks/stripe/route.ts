import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { stripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/server/billing.service";

export async function POST(request: Request) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ message: "Non configuré" }, { status: 400 });
  const body = await request.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    log.warn("stripe_webhook_rejected");
    return NextResponse.json({ message: "Signature invalide" }, { status: 400 });
  }
  await handleStripeEvent(event);
  return NextResponse.json({ received: true });
}
