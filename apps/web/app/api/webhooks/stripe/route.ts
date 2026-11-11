import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { stripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/server/billing.service";

// Classe d'erreur du SDK ou code interne (« stripe_subscription_price_unknown ») : jamais un message libre,
// qui pourrait contenir des données personnelles.
const causeOf = (error: unknown): string => {
  if (error instanceof Stripe.errors.StripeError) return error.type;
  return error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : "interne";
};

export async function POST(request: Request) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Réglage manquant de notre côté, pas une requête fautive : l'erreur se voit, et Stripe renverra.
    log.error("stripe_webhook_not_configured");
    return NextResponse.json({ message: "Non configuré" }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(body, signature ?? "", secret);
  } catch {
    log.warn("stripe_webhook_rejected");
    return NextResponse.json({ message: "Signature invalide" }, { status: 400 });
  }
  try {
    await handleStripeEvent(event);
  } catch (error) {
    // Panne chez nous ou chez Stripe : un 500 pour que Stripe renvoie l'événement, resté rejouable.
    log.error("stripe_webhook_failed", { code: event.type });
    Sentry.captureMessage("stripe_webhook_failed", {
      level: "error",
      tags: { type: event.type, cause: causeOf(error) },
    });
    await Sentry.flush(2000);
    return NextResponse.json({ message: "Traitement impossible" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
