import type Stripe from "stripe";
import { billingEmailsFor, isPaidPlan, type PlanKey, type SubscriptionState } from "@tartan/domain";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { billingEnabled, planForPriceId, stripe } from "@/lib/stripe";
import { enqueueBillingEmail, flushEmailOutbox } from "./email-outbox.service";
import { applySubscriptionInTransaction, syncEntitlementsInTransaction } from "./subscription-state.service";

const STRIPE_STATUS: Partial<Record<Stripe.Subscription.Status, SubscriptionState>> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  // Relances épuisées : l'accès payant s'arrête, les données restent.
  unpaid: "canceled",
  paused: "canceled",
  canceled: "canceled",
};

// Un paiement jamais abouti n'a jamais ouvert de droits : il n'en retire pas non plus.
const NEVER_PAID: readonly Stripe.Subscription.Status[] = ["incomplete", "incomplete_expired"];
const ENTITLED: readonly Stripe.Subscription.Status[] = ["active", "trialing", "past_due"];

const fromUnix = (seconds: number | null | undefined): Date | null => (seconds ? new Date(seconds * 1000) : null);

const objectId = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  return value && typeof value === "object" && "id" in value && typeof value.id === "string" ? value.id : null;
};

const subscriptionsForCustomer = async (customer: string): Promise<Stripe.Subscription[]> => {
  const subscriptions: Stripe.Subscription[] = [];
  const client = stripe();
  let startingAfter: string | undefined;
  // Aucun résultat partiel ne doit décider des droits : une pagination anormale demande une intervention.
  for (let page = 0; page < 10; page++) {
    const result = await client.subscriptions.list({
      customer,
      status: "all",
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    subscriptions.push(...result.data);
    if (!result.has_more) return subscriptions;
    startingAfter = result.data.at(-1)?.id;
    if (!startingAfter) break;
  }
  throw new Error("stripe_subscription_pagination_limit");
};

// L'ordre des webhooks n'est pas garanti : on relit l'état chez Stripe au lieu de croire l'événement.
// La lecture se fait hors transaction, puis la génération est comparée sous verrou : une réponse lente
// ne peut pas écraser une synchronisation commencée après elle.
export const reconcileStripeSubscription = async (
  organizationId: string,
  event?: { id: string; type: string },
): Promise<void> => {
  if (event && (await prisma.billingEvent.findUnique({ where: { id: event.id } }))) return;
  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: { billingRevision: { increment: 1 }, billingSyncAttemptedAt: new Date() },
    select: { stripeCustomerId: true, billingRevision: true },
  });
  if (!org.stripeCustomerId) throw new Error("stripe_customer_missing");
  const subscriptions = await subscriptionsForCustomer(org.stripeCustomerId);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    if (event && (await tx.billingEvent.findUnique({ where: { id: event.id } }))) return;
    const currentOrg = await tx.organization.findUnique({ where: { id: organizationId } });
    if (!currentOrg) return;
    // Une synchronisation plus récente lit un état au moins aussi frais, et Stripe la rejoue si elle échoue.
    // Cet événement est donc acquitté sans être enregistré, pour que son doublon puisse encore s'appliquer.
    if (currentOrg.billingRevision !== org.billingRevision) return;
    const current = await tx.subscription.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } });
    const related = subscriptions.filter(
      (s) =>
        !NEVER_PAID.includes(s.status) &&
        objectId(s.customer) === org.stripeCustomerId &&
        (s.metadata.organizationId === organizationId ||
          (current?.provider === "stripe" && current.providerRef === s.id)),
    );
    const entitled = related.filter((s) => ENTITLED.includes(s.status));
    if (entitled.length > 1) log.error("stripe_multiple_subscriptions", { organizationId, count: entitled.length });
    const selected = [...(entitled.length ? entitled : related)].sort(
      (a, b) => b.created - a.created || b.id.localeCompare(a.id),
    )[0];
    const onStore = current?.provider === "revenuecat" && current.status !== "canceled";
    if (selected && onStore && entitled.length) throw new Error("stripe_store_subscription_conflict");
    if (selected && !onStore) {
      const items = selected.items.data.filter((item) => planForPriceId(item.price.id));
      const status = STRIPE_STATUS[selected.status];
      if (!status || (status !== "canceled" && items.length !== 1))
        throw new Error("stripe_subscription_price_unknown");
      const item = items[0] ?? selected.items.data[0];
      const plan = status === "canceled" ? "discovery" : (planForPriceId(item?.price.id) ?? "discovery");
      // Selon la version d'API du compte, la date est sur l'abonnement ou sur la ligne.
      const end = fromUnix(
        item?.current_period_end ??
          (selected as Stripe.Subscription & { current_period_end?: number }).current_period_end,
      );
      // Une résiliation en fin de période peut n'indiquer que ce drapeau, selon la version d'API.
      const cancelAt = fromUnix(selected.cancel_at) ?? (selected.cancel_at_period_end ? end : null);
      const unchanged =
        currentOrg.plan === plan &&
        current?.provider === "stripe" &&
        current.providerRef === selected.id &&
        current.status === status &&
        current.planKey === plan &&
        current.currentPeriodEnd?.getTime() === end?.getTime() &&
        current.cancelAt?.getTime() === cancelAt?.getTime();
      if (unchanged) await syncEntitlementsInTransaction(tx, organizationId, plan);
      else
        await applySubscriptionInTransaction(tx, {
          organizationId,
          plan,
          status,
          provider: "stripe",
          providerRef: selected.id,
          currentPeriodEnd: end,
          cancelAt,
        });
      // Sous le verrou : webhook et réconciliation concurrents voient la même transition une seule fois.
      const owner = await tx.user.findUniqueOrThrow({ where: { id: currentOrg.ownerId }, select: { email: true } });
      const emails = billingEmailsFor(
        {
          paid: isPaidPlan(currentOrg.plan),
          status: current?.status ?? null,
          cancelAt: current?.cancelAt ?? null,
          subscriptionId: current?.provider === "stripe" ? current.providerRef : null,
        },
        { paid: isPaidPlan(plan), status, cancelAt, subscriptionId: selected.id },
      );
      for (const email of emails) {
        await enqueueBillingEmail(tx, {
          organizationId,
          to: owner.email,
          email,
          space: currentOrg.name,
          plan: isPaidPlan(plan) ? plan : ((current?.planKey as PlanKey | undefined) ?? plan),
          interval: item?.price.recurring?.interval === "month" ? "month" : "year",
          trialEnd: fromUnix(selected.trial_end),
        });
      }
    } else if (!selected && current?.provider === "stripe") {
      // Une réponse incomplète ou inattendue ne résilie pas un espace payant.
      throw new Error("stripe_subscription_missing");
    }
    await tx.organization.update({ where: { id: organizationId }, data: { billingSyncedAt: new Date() } });
    if (event) await tx.billingEvent.create({ data: { id: event.id, provider: "stripe", type: event.type } });
  });
  // L'envoi suit la validation. S'il échoue, la tâche de notifications reprend pendant 24 h.
  await flushEmailOutbox().catch(() => log.warn("email_outbox_flush_failed"));
};

export const handleStripeEvent = async (event: Stripe.Event): Promise<void> => {
  if (!event.type.startsWith("customer.subscription.")) return;
  if (await prisma.billingEvent.findUnique({ where: { id: event.id } })) return;
  const customerId = objectId((event.data.object as { customer?: unknown }).customer);
  // Le rattachement passe par le client enregistré, jamais par une métadonnée seule.
  const org = customerId
    ? await prisma.organization.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } })
    : null;
  if (org) {
    await reconcileStripeSubscription(org.id, event);
    return;
  }
  // Le compte Stripe peut porter d'autres produits : cet abonnement n'est pas le nôtre.
  log.warn("stripe_subscription_without_organization");
  await prisma.billingEvent.createMany({
    data: [{ id: event.id, provider: "stripe", type: event.type }],
    skipDuplicates: true,
  });
};

// Rattrape un webhook perdu : les espaces les plus anciennement vérifiés passent d'abord.
export const reconcileStripeSubscriptions = async (now = new Date()): Promise<{ synced: number; failed: number }> => {
  if (!billingEnabled()) return { synced: 0, failed: 0 };
  const orgs = await prisma.organization.findMany({
    where: {
      stripeCustomerId: { not: null },
      OR: [{ billingSyncAttemptedAt: null }, { billingSyncAttemptedAt: { lt: new Date(now.getTime() - 3600_000) } }],
    },
    orderBy: [{ billingSyncAttemptedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    select: { id: true },
    take: 20,
  });
  let synced = 0;
  let failed = 0;
  for (let i = 0; i < orgs.length; i += 5) {
    await Promise.all(
      orgs.slice(i, i + 5).map(async (org) => {
        try {
          await reconcileStripeSubscription(org.id);
          synced++;
        } catch {
          failed++;
          log.error("stripe_reconciliation_failed", { organizationId: org.id });
        }
      }),
    );
  }
  return { synced, failed };
};
