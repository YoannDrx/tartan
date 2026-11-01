import {
  type BillingInterval,
  isPaidPlan,
  isReferralQualified,
  isStaff,
  isWithinLimit,
  MAX_REWARDS_PER_YEAR,
  type LimitKey,
  PLANS,
  planForSubscription,
  type PlanKey,
  type PlanLimits,
  type SubscriptionState,
  TRIAL_DAYS,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { createElement } from "react";
import type Stripe from "stripe";
import { NotificationEmail } from "@email/auth";
import { env } from "@/lib/env";
import { AppError, forbidden, invalid, notFound } from "@/lib/errors";
import { log } from "@/lib/logger";
import { sendEmail } from "@/lib/mail";
import { deleteAsset, videoEnabled } from "@/lib/mux";
import { prisma } from "@/lib/prisma";
import { billingEnabled, planForPriceId, priceIdFor, stripe } from "@/lib/stripe";
import { audit, requireOrgMember } from "./access";

export const ensurePlans = async (): Promise<void> => {
  const names: Record<PlanKey, string> = { pilot: "Pilote", discovery: "Découverte", coach: "Coach", club: "Club" };
  await prisma.plan.createMany({
    data: (Object.keys(PLANS) as PlanKey[]).map((key) => ({ key, name: names[key], limits: PLANS[key].limits })),
    skipDuplicates: true,
  });
};

// Les droits sont la seule source lue par l'app, quel que soit le canal de paiement (§ 17.3).
export const syncEntitlements = async (organizationId: string, plan: PlanKey): Promise<void> => {
  const limits = PLANS[plan].limits;
  await prisma.$transaction(
    (Object.entries(limits) as [keyof PlanLimits, number | null][]).map(([key, value]) =>
      prisma.entitlement.upsert({
        where: { organizationId_key: { organizationId, key } },
        create: { organizationId, key, value: { limit: value }, source: "plan" },
        update: { value: { limit: value }, source: "plan" },
      }),
    ),
  );
};

export const limitsOf = async (organizationId: string): Promise<PlanLimits> => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { plan: true } });
  const rows = await prisma.entitlement.findMany({ where: { organizationId } });
  const limits = { ...PLANS[org.plan].limits };
  for (const row of rows) {
    if (row.key in limits) limits[row.key as keyof PlanLimits] = (row.value as { limit: number | null }).limit;
  }
  return limits;
};

const startOfMonth = (now: Date): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

export const usageOf = async (organizationId: string, now: Date = new Date()) => {
  const [maxAthletes, maxGroups, maxCoaches, maxVideosPerMonth] = await Promise.all([
    prisma.athlete.count({ where: { organizationId } }),
    prisma.group.count({ where: { organizationId } }),
    prisma.organizationMember.count({ where: { organizationId, role: { in: ["owner", "coach", "assistant"] } } }),
    prisma.video.count({ where: { organizationId, createdAt: { gte: startOfMonth(now) } } }),
  ]);
  return { maxAthletes, maxGroups, maxCoaches, maxVideosPerMonth };
};

const LIMIT_MESSAGES: Record<LimitKey, string> = {
  maxAthletes: m.billing.limitAthletes,
  maxGroups: m.billing.limitGroups,
  maxCoaches: m.billing.limitCoaches,
  maxVideosPerMonth: m.billing.limitVideos,
};

// Dépasser une offre bloque l'ajout, jamais l'accès à ce qui existe déjà.
export const assertWithinPlan = async (organizationId: string, key: LimitKey): Promise<void> => {
  const [limits, usage] = await Promise.all([limitsOf(organizationId), usageOf(organizationId)]);
  if (!isWithinLimit(limits[key], usage[key])) throw new AppError(402, "plan_limit", LIMIT_MESSAGES[key]);
};

export const getBillingOverview = async (userId: string, organizationId: string) => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  if (!isStaff(access.role)) throw forbidden();
  const [org, subscription, limits, usage] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { plan: true, stripeCustomerId: true },
    }),
    prisma.subscription.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
    limitsOf(organizationId),
    usageOf(organizationId),
  ]);
  return {
    plan: org.plan,
    status: subscription?.status ?? "active",
    provider: subscription?.provider ?? "manual",
    currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
    cancelAt: subscription?.cancelAt?.toISOString() ?? null,
    limits,
    usage,
    canManage: access.role === "owner",
    billingEnabled: billingEnabled(),
    hasCustomer: Boolean(org.stripeCustomerId),
  };
};

const INVOICE_FOOTER =
  "Yodev, Yoann Andrieux, entrepreneur individuel, SIREN 803 272 590. TVA non applicable, article 293 B du CGI.";

export const createCheckout = async (
  userId: string,
  organizationId: string,
  input: { plan: PlanKey; interval: BillingInterval },
): Promise<{ url: string }> => {
  await requireOrgMember(userId, organizationId, "manageSubscription");
  const price = priceIdFor(input.plan, input.interval);
  if (!billingEnabled() || !price) throw new AppError(503, "billing_disabled", m.billing.disabled);
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } });
  // Un abonnement en cours se change depuis le portail : un second Checkout ferait payer deux fois.
  const current = await prisma.subscription.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } });
  if (current && current.status !== "canceled" && isPaidPlan(current.planKey as PlanKey)) {
    if (current.provider === "revenuecat") throw new AppError(409, "store_subscription", m.billing.storeHint);
    if (current.provider === "stripe" && org.stripeCustomerId) return createPortal(userId, organizationId);
  }
  const client = stripe();
  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const customer = await client.customers.create(
      {
        email: owner.email,
        name: org.name,
        metadata: { organizationId },
        // Identité du vendeur et franchise en base de TVA : mentions obligatoires sur chaque facture.
        invoice_settings: { footer: INVOICE_FOOTER },
      },
      { idempotencyKey: `customer-${organizationId}` },
    );
    customerId = customer.id;
    await prisma.organization.update({ where: { id: organizationId }, data: { stripeCustomerId: customerId } });
  }
  // Un seul essai par espace : résilier puis reprendre ne le redonne pas.
  const alreadyPaid = await prisma.subscription.count({
    where: { organizationId, provider: { in: ["stripe", "revenuecat"] } },
  });
  const appUrl = env().NEXT_PUBLIC_APP_URL;
  const session = await client.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: organizationId,
    line_items: [{ price, quantity: 1 }],
    locale: "fr",
    allow_promotion_codes: true,
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
    automatic_tax: { enabled: env().STRIPE_TAX_ENABLED === "true" },
    subscription_data: {
      metadata: { organizationId },
      ...(alreadyPaid === 0 ? { trial_period_days: TRIAL_DAYS } : {}),
    },
    // Le compte Stripe sert plusieurs produits : la page de paiement doit afficher Tartan.
    branding_settings: {
      display_name: "Tartan",
      button_color: "#C4442B",
      background_color: "#15161A",
      icon: { type: "url", url: `${appUrl}/icon-512.png` },
    },
    custom_text: { submit: { message: `En validant, tu acceptes les conditions de vente : ${appUrl}/cgv` } },
    success_url: `${appUrl}/abonnement?merci=1`,
    cancel_url: `${appUrl}/abonnement`,
  });
  if (!session.url) throw new Error("stripe_checkout_url_missing");
  return { url: session.url };
};

export const createPortal = async (userId: string, organizationId: string): Promise<{ url: string }> => {
  await requireOrgMember(userId, organizationId, "manageSubscription");
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { stripeCustomerId: true },
  });
  if (!billingEnabled() || !org.stripeCustomerId) throw notFound();
  const session = await stripe().billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    locale: "fr",
    ...(env().STRIPE_PORTAL_CONFIGURATION_ID ? { configuration: env().STRIPE_PORTAL_CONFIGURATION_ID } : {}),
    return_url: `${env().NEXT_PUBLIC_APP_URL}/abonnement`,
  });
  return { url: session.url };
};

// Point unique de mise à jour : abonnement, offre de l'espace, droits.
export const applySubscription = async (input: {
  organizationId: string;
  plan: PlanKey;
  status: SubscriptionState;
  provider: "stripe" | "revenuecat" | "manual";
  providerRef: string | null;
  currentPeriodEnd: Date | null;
  cancelAt: Date | null;
  now?: Date;
}): Promise<void> => {
  const now = input.now ?? new Date();
  const existing = await prisma.subscription.findFirst({
    where: { organizationId: input.organizationId },
    orderBy: { createdAt: "desc" },
  });
  const effective = planForSubscription(input.plan, input.status);
  const paidSince =
    input.status === "active" && isPaidPlan(effective)
      ? (existing?.paidSince ?? now)
      : input.status === "canceled"
        ? null
        : (existing?.paidSince ?? null);
  const data = {
    planKey: effective,
    status: input.status,
    provider: input.provider,
    providerRef: input.providerRef,
    currentPeriodEnd: input.currentPeriodEnd,
    cancelAt: input.cancelAt,
    paidSince,
  };
  if (existing) await prisma.subscription.update({ where: { id: existing.id }, data });
  else await prisma.subscription.create({ data: { ...data, organizationId: input.organizationId } });
  await prisma.organization.update({ where: { id: input.organizationId }, data: { plan: effective } });
  await syncEntitlements(input.organizationId, effective);
  await audit({
    organizationId: input.organizationId,
    action: `plan_${effective}_${input.status}`,
    entity: "subscription",
  });
  log.info("subscription_applied", { organizationId: input.organizationId, status: input.status });
};

// Marqué après application : si la base tombe entre les deux, le renvoi du prestataire rejoue l'événement.
const alreadyProcessed = async (id: string): Promise<boolean> =>
  Boolean(await prisma.billingEvent.findUnique({ where: { id }, select: { id: true } }));

const markProcessed = async (id: string, provider: string, type: string): Promise<void> => {
  await prisma.billingEvent.createMany({ data: [{ id, provider, type }], skipDuplicates: true });
};

const STRIPE_STATUS: Partial<Record<Stripe.Subscription.Status, SubscriptionState>> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  // Relances épuisées : l'accès payant s'arrête, les données restent.
  unpaid: "canceled",
  paused: "canceled",
  canceled: "canceled",
  incomplete_expired: "canceled",
};

const fromUnix = (seconds: number | null | undefined): Date | null => (seconds ? new Date(seconds * 1000) : null);

export const handleStripeEvent = async (event: Stripe.Event): Promise<void> => {
  if (!event.type.startsWith("customer.subscription.")) return;
  if (await alreadyProcessed(event.id)) return;
  const subscription = event.data.object as Stripe.Subscription & { current_period_end?: number };
  const organizationId = subscription.metadata.organizationId;
  if (!organizationId) {
    // Le compte Stripe peut porter d'autres produits : cet abonnement n'est pas le nôtre.
    log.warn("stripe_subscription_without_organization");
    return;
  }
  const item = subscription.items.data[0];
  const plan = planForPriceId(item?.price.id);
  const status = STRIPE_STATUS[subscription.status];
  const current = await prisma.subscription.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } });
  // La fin d'un ancien abonnement ne doit pas faire retomber l'offre qui l'a remplacé.
  const stale = status === "canceled" && current?.providerRef && current.providerRef !== subscription.id;
  if (status && (plan || status === "canceled") && !stale) {
    await applySubscription({
      organizationId,
      plan: plan ?? "discovery",
      status,
      provider: "stripe",
      providerRef: subscription.id,
      // Selon la version d'API du compte, la date est sur l'abonnement ou sur la ligne.
      currentPeriodEnd: fromUnix(item?.current_period_end ?? subscription.current_period_end),
      cancelAt: fromUnix(subscription.cancel_at),
    });
  }
  await markProcessed(event.id, "stripe", event.type);
};

type RevenueCatEvent = {
  id: string;
  type: string;
  app_user_id: string;
  product_id?: string;
  expiration_at_ms?: number | null;
  period_type?: string;
};

const planForProduct = (productId: string | undefined): PlanKey | null => {
  if (!productId) return null;
  const e = env();
  if (e.REVENUECAT_PRODUCT_COACH.split(",").includes(productId)) return "coach";
  if (e.REVENUECAT_PRODUCT_CLUB.split(",").includes(productId)) return "club";
  return null;
};

// L'identifiant RevenueCat est celui de l'organisation : l'abonnement appartient à l'espace (§ 17.1).
export const handleRevenueCatEvent = async (event: RevenueCatEvent): Promise<void> => {
  if (await alreadyProcessed(event.id)) return;
  const organizationId = event.app_user_id.startsWith("org_") ? event.app_user_id.slice(4) : null;
  const org = organizationId
    ? await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })
    : null;
  if (!organizationId || !org) {
    await markProcessed(event.id, "revenuecat", event.type);
    return;
  }
  const plan = planForProduct(event.product_id);
  const periodEnd = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
  const base = {
    organizationId,
    provider: "revenuecat" as const,
    providerRef: event.app_user_id,
    currentPeriodEnd: periodEnd,
  };
  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE":
    case "UNCANCELLATION":
      if (plan) {
        await applySubscription({
          ...base,
          plan,
          status: event.period_type === "TRIAL" ? "trialing" : "active",
          cancelAt: null,
        });
      }
      break;
    case "CANCELLATION":
      if (plan) await applySubscription({ ...base, plan, status: "active", cancelAt: periodEnd });
      break;
    case "BILLING_ISSUE":
      if (plan) await applySubscription({ ...base, plan, status: "past_due", cancelAt: null });
      break;
    case "EXPIRATION":
      await applySubscription({ ...base, plan: "discovery", status: "canceled", cancelAt: null });
      break;
    default:
      break;
  }
  await markProcessed(event.id, "revenuecat", event.type);
};

// Le compte disparaît : l'abonnement web s'arrête tout de suite, sinon le client paierait pour rien.
export const cancelStripeSubscriptions = async (organizationIds: string[]): Promise<void> => {
  if (organizationIds.length === 0 || !billingEnabled()) return;
  const subscriptions = await prisma.subscription.findMany({
    where: { organizationId: { in: organizationIds }, provider: "stripe", status: { not: "canceled" } },
    select: { providerRef: true },
  });
  for (const { providerRef } of subscriptions) {
    if (providerRef) await stripe().subscriptions.cancel(providerRef);
  }
};

const paymentFingerprint = async (customerId: string | null): Promise<string | null> => {
  if (!customerId || !billingEnabled()) return null;
  const methods = await stripe().paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
  return methods.data[0]?.card?.fingerprint ?? null;
};

// Offre un mois sur le canal de paiement du bénéficiaire. Sans abonnement Stripe, la récompense attend.
const applyReward = async (rewardId: string): Promise<boolean> => {
  const reward = await prisma.referralReward.findUniqueOrThrow({ where: { id: rewardId } });
  const org = await prisma.organization.findFirst({
    where: { ownerId: reward.beneficiaryId, stripeCustomerId: { not: null }, plan: { in: ["coach", "club"] } },
    select: { id: true, plan: true, stripeCustomerId: true },
  });
  const prices = org ? PLANS[org.plan].prices : null;
  if (!org?.stripeCustomerId || !prices || !billingEnabled()) return false;
  const tx = await stripe().customers.createBalanceTransaction(
    org.stripeCustomerId,
    { amount: -prices.month, currency: "eur", description: "Parrainage Tartan : un mois offert" },
    { idempotencyKey: `reward-${reward.id}` },
  );
  await prisma.referralReward.update({ where: { id: reward.id }, data: { appliedAt: new Date(), providerRef: tx.id } });
  return true;
};

// Tâche planifiée : qualifie les filleuls payants depuis 30 jours, écarte les abus, applique les mois offerts.
export const processReferrals = async (
  now: Date = new Date(),
): Promise<{ qualified: number; applied: number; rejected: number }> => {
  const referrals = await prisma.referral.findMany({
    where: { status: { in: ["signed_up", "trialing"] }, referredOrgId: { not: null } },
    include: { code: true },
  });
  let qualified = 0;
  let rejected = 0;
  for (const referral of referrals) {
    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: referral.referredOrgId as string },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription) continue;
    const ok = isReferralQualified({
      plan: subscription.planKey as PlanKey,
      status: subscription.status,
      paidSince: subscription.paidSince,
      now,
    });
    if (!ok) continue;
    const beneficiary = await referrerBeneficiary(referral.code.ownerType, referral.code.ownerId);
    if (!beneficiary) continue;
    const referredOrg = await prisma.organization.findUniqueOrThrow({
      where: { id: referral.referredOrgId as string },
      select: { stripeCustomerId: true },
    });
    const beneficiaryOrg = await prisma.organization.findFirst({
      where: { ownerId: beneficiary },
      select: { stripeCustomerId: true },
    });
    const [a, b] = await Promise.all([
      paymentFingerprint(referredOrg.stripeCustomerId),
      paymentFingerprint(beneficiaryOrg?.stripeCustomerId ?? null),
    ]);
    if (a && a === b) {
      await prisma.referral.update({ where: { id: referral.id }, data: { status: "rejected" } });
      await audit({ action: "referral_rejected_same_payment", entity: "referral", entityId: referral.id });
      rejected += 1;
      continue;
    }
    const yearAgo = new Date(now.getTime() - 365 * 86400 * 1000);
    const received = await prisma.referralReward.count({
      where: { beneficiaryId: beneficiary, createdAt: { gte: yearAgo } },
    });
    await prisma.referral.update({ where: { id: referral.id }, data: { status: "qualified", qualifiedAt: now } });
    const beneficiaries =
      received < MAX_REWARDS_PER_YEAR ? [beneficiary, referral.referredUserId] : [referral.referredUserId];
    await prisma.referralReward.createMany({
      data: beneficiaries.map((beneficiaryId) => ({
        referralId: referral.id,
        beneficiaryId,
        kind: "free_month" as const,
      })),
    });
    qualified += 1;
  }
  const pending = await prisma.referralReward.findMany({
    where: { appliedAt: null },
    select: { id: true, referralId: true },
  });
  let applied = 0;
  for (const reward of pending) {
    if (await applyReward(reward.id)) {
      applied += 1;
      await prisma.referral.update({ where: { id: reward.referralId }, data: { status: "rewarded" } });
    }
  }
  log.info("referrals_processed", { count: qualified });
  return { qualified, applied, rejected };
};

// Un athlète parraine pour son coach : le mois offert revient au propriétaire de son espace (§ 17.4).
const referrerBeneficiary = async (ownerType: "user" | "organization", ownerId: string): Promise<string | null> => {
  if (ownerType === "organization") {
    const org = await prisma.organization.findUnique({ where: { id: ownerId }, select: { ownerId: true } });
    return org?.ownerId ?? null;
  }
  const owned = await prisma.organization.findFirst({ where: { ownerId }, select: { id: true } });
  if (owned) return ownerId;
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: ownerId, role: "athlete" },
    select: { organization: { select: { ownerId: true } } },
  });
  return membership?.organization.ownerId ?? null;
};

const PURGE_NOTICE_DAYS = 14;
const DAY_MS = 86400 * 1000;

// Le propriétaire est prévenu par e-mail ; rien ne part avant la fin du préavis annoncé par les CGV.
const purgeNoticeServed = async (
  organizationId: string,
  name: string,
  ownerEmail: string,
  now: Date,
): Promise<boolean> => {
  const notice = await prisma.auditLog.findFirst({
    where: { organizationId, action: "video_purge_notice" },
    orderBy: { at: "desc" },
  });
  const age = notice ? now.getTime() - notice.at.getTime() : null;
  if (age === null || age > 3 * PURGE_NOTICE_DAYS * DAY_MS) {
    await prisma.auditLog.create({
      data: { organizationId, action: "video_purge_notice", entity: "video", at: now },
    });
    const body = m.billing.purgeNotice(PURGE_NOTICE_DAYS);
    await sendEmail({
      to: ownerEmail,
      subject: `Vidéos de ${name} : fin de conservation`,
      react: createElement(NotificationEmail, {
        title: "Fin de conservation de vidéos",
        body,
        url: `${env().NEXT_PUBLIC_APP_URL}/videos?espace=${organizationId}`,
      }),
    }).catch(() => log.error("purge_notice_email_failed"));
    return false;
  }
  return age >= PURGE_NOTICE_DAYS * DAY_MS;
};

// Conservation vidéo : coût maîtrisé (§ 17.1), après préavis.
export const purgeExpiredVideos = async (now: Date = new Date()): Promise<number> => {
  const orgs = await prisma.organization.findMany({
    where: { plan: { in: ["discovery", "coach", "club"] } },
    select: { id: true, name: true, plan: true, owner: { select: { email: true } } },
  });
  let purged = 0;
  for (const org of orgs) {
    const days = PLANS[org.plan].limits.videoRetentionDays;
    if (days === null) continue;
    const before = new Date(now.getTime() - days * DAY_MS);
    const soon = new Date(before.getTime() + PURGE_NOTICE_DAYS * DAY_MS);
    const expiring = await prisma.video.count({ where: { organizationId: org.id, createdAt: { lt: soon } } });
    if (expiring === 0 || !(await purgeNoticeServed(org.id, org.name, org.owner.email, now))) continue;
    const videos = await prisma.video.findMany({
      where: { organizationId: org.id, createdAt: { lt: before } },
      select: { id: true, muxAssetId: true },
    });
    for (const video of videos) {
      if (video.muxAssetId && videoEnabled())
        await deleteAsset(video.muxAssetId).catch(() => log.warn("mux_asset_delete_failed"));
      await prisma.video.delete({ where: { id: video.id } });
      purged += 1;
    }
  }
  log.info("videos_purged", { count: purged });
  return purged;
};

export const assertRevenueCatAuth = (header: string | null): void => {
  const expected = env().REVENUECAT_WEBHOOK_AUTH;
  if (!expected || header !== `Bearer ${expected}`) throw invalid();
};
