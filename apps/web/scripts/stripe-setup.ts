// Crée ou retrouve les produits et prix Tartan sur le compte Stripe de la clé utilisée, sans doublon.
// Mode test d'abord : STRIPE_SECRET_KEY=sk_test_... ; en production, relancer avec la clé live.
import { PLANS } from "@tartan/domain";
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("STRIPE_SECRET_KEY manquante.");
const client = new Stripe(key);

const ensurePrice = async (lookupKey: string, product: string, amount: number, interval: "month" | "year") => {
  const found = await client.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  const current = found.data[0];
  if (current && current.product !== product) throw new Error(`Tarif ${lookupKey} associé à un autre produit.`);
  if (
    current?.unit_amount === amount &&
    current.currency === "eur" &&
    current.recurring?.interval === interval &&
    current.recurring.interval_count === 1
  )
    return current.id;
  const price = await client.prices.create({
    product,
    currency: "eur",
    unit_amount: amount,
    recurring: { interval },
    lookup_key: lookupKey,
    transfer_lookup_key: true,
  });
  return price.id;
};

const ensureProduct = async (id: string, name: string, description: string, lookupKeys: string[]) => {
  // Les produits créés dans le Dashboard ont un identifiant généré : retrouver ceux de leurs tarifs.
  const prices = await client.prices.list({ lookup_keys: lookupKeys, limit: 100 });
  const products = [
    ...new Set(prices.data.map((price) => (typeof price.product === "string" ? price.product : price.product.id))),
  ];
  if (products.length > 1) throw new Error(`Les tarifs de ${name} sont associés à plusieurs produits.`);
  if (products[0]) return products[0];
  try {
    return (await client.products.retrieve(id)).id;
  } catch (error) {
    if (!(error instanceof Stripe.errors.StripeInvalidRequestError) || error.code !== "resource_missing") throw error;
    return (await client.products.create({ id, name, description, tax_code: "txcd_10103001" })).id;
  }
};

const coach = await ensureProduct(
  "tartan_coach",
  "Tartan Coach",
  "Jusqu’à 30 athlètes, groupes illimités, jusqu’à 100 vidéos par mois.",
  ["tartan_coach_month", "tartan_coach_year"],
);
const club = await ensureProduct(
  "tartan_club",
  "Tartan Club",
  "Coachs et athlètes illimités, jusqu’à 500 vidéos par mois.",
  ["tartan_club_month", "tartan_club_year"],
);
const prices = {
  STRIPE_PRICE_COACH_MONTH: await ensurePrice("tartan_coach_month", coach, PLANS.coach.prices?.month ?? 0, "month"),
  STRIPE_PRICE_COACH_YEAR: await ensurePrice("tartan_coach_year", coach, PLANS.coach.prices?.year ?? 0, "year"),
  STRIPE_PRICE_CLUB_MONTH: await ensurePrice("tartan_club_month", club, PLANS.club.prices?.month ?? 0, "month"),
  STRIPE_PRICE_CLUB_YEAR: await ensurePrice("tartan_club_year", club, PLANS.club.prices?.year ?? 0, "year"),
};
// Portail client propre à Tartan : les autres produits du compte n'y apparaissent pas.
const portalMarker = "tartan";
const portals = await client.billingPortal.configurations.list({ limit: 100, active: true });
const portalParams = {
  business_profile: {
    headline: "Tartan : gère ton abonnement",
    privacy_policy_url: "https://tartan.coach/confidentialite",
    terms_of_service_url: "https://tartan.coach/cgv",
  },
  default_return_url: "https://app.tartan.coach/abonnement",
  metadata: { app: portalMarker },
  features: {
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    customer_update: { enabled: true, allowed_updates: ["address", "email", "name", "tax_id"] as const },
    subscription_cancel: { enabled: true, mode: "at_period_end" as const },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"] as const,
      proration_behavior: "create_prorations" as const,
      products: [
        {
          product: coach,
          prices: [prices.STRIPE_PRICE_COACH_MONTH, prices.STRIPE_PRICE_COACH_YEAR],
          adjustable_quantity: { enabled: false },
        },
        {
          product: club,
          prices: [prices.STRIPE_PRICE_CLUB_MONTH, prices.STRIPE_PRICE_CLUB_YEAR],
          adjustable_quantity: { enabled: false },
        },
      ],
    },
  },
};
const existingPortal = portals.data.find((c) => c.metadata?.app === portalMarker);
const portal = existingPortal
  ? await client.billingPortal.configurations.update(existingPortal.id, portalParams as never)
  : await client.billingPortal.configurations.create(portalParams as never);

// Webhook idempotent : même adresse, on ne recrée pas.
const webhookUrl = "https://app.tartan.coach/api/webhooks/stripe";
const hooks = await client.webhookEndpoints.list({ limit: 100 });
let webhookSecret: string | null = null;
if (!hooks.data.some((h) => h.url === webhookUrl)) {
  const hook = await client.webhookEndpoints.create({
    url: webhookUrl,
    description: "Tartan",
    // Version fixée : le contenu des événements ne doit pas dépendre du réglage du compte.
    api_version: "2025-03-31.basil",
    enabled_events: ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"],
  });
  webhookSecret = hook.secret ?? null;
}

const out = {
  ...prices,
  STRIPE_PORTAL_CONFIGURATION_ID: portal.id,
  ...(webhookSecret ? { STRIPE_WEBHOOK_SECRET: webhookSecret } : {}),
};
for (const [name, value] of Object.entries(out)) console.log(`${name}=${value}`);
