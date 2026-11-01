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
  if (current?.unit_amount === amount) return current.id;
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

const ensureProduct = async (id: string, name: string, description: string) => {
  try {
    return (await client.products.retrieve(id)).id;
  } catch {
    return (await client.products.create({ id, name, description, tax_code: "txcd_10103001" })).id;
  }
};

const coach = await ensureProduct("tartan_coach", "Tartan Coach", "Jusqu'à 30 athlètes, groupes illimités, vidéo étendue.");
const club = await ensureProduct("tartan_club", "Tartan Club", "Plusieurs coachs, athlètes et vidéo illimités.");
const prices = {
  STRIPE_PRICE_COACH_MONTH: await ensurePrice("tartan_coach_month", coach, PLANS.coach.prices?.month ?? 0, "month"),
  STRIPE_PRICE_COACH_YEAR: await ensurePrice("tartan_coach_year", coach, PLANS.coach.prices?.year ?? 0, "year"),
  STRIPE_PRICE_CLUB_MONTH: await ensurePrice("tartan_club_month", club, PLANS.club.prices?.month ?? 0, "month"),
  STRIPE_PRICE_CLUB_YEAR: await ensurePrice("tartan_club_year", club, PLANS.club.prices?.year ?? 0, "year"),
};
for (const [name, value] of Object.entries(prices)) console.log(`${name}=${value}`);
