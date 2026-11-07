import { withCheckoutIntent, intentCheckout } from "./checkout-intent.service";
import { todayIso } from "@/lib/dates";
import {
  type BillingInterval,
  isPaidPlan,
  isReferralQualified,
  isStaff,
  isWithinLimit,
  MAX_REWARDS_PER_YEAR,
  type LimitKey,
  PLANS,
  type PlanKey,
  type PlanLimits,
  TRIAL_DAYS,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { createElement } from "react";
import { PurgeNoticeEmail } from "@email/billing";
import { env } from "@/lib/env";
import { AppError, forbidden, invalid, notFound } from "@/lib/errors";
import { log } from "@/lib/logger";
import { hasBearer } from "@/lib/secure-compare";
import { sendEmail } from "@/lib/mail";
import { videoEnabled } from "@/lib/mux";
import { drainExternalDeletions } from "./external-deletion.service";
import { reconcileStripeSubscription, subscriptionsForCustomer } from "./stripe-subscriptions.service";
import { prisma } from "@/lib/prisma";
import { billingEnabled, priceIdFor, stripe } from "@/lib/stripe";
import { audit, requireOrgMember } from "./access";
import { applySubscription } from "./subscription-state.service";
export { applySubscription, syncEntitlements } from "./subscription-state.service";
export { handleStripeEvent } from "./stripe-subscriptions.service";

export const ensurePlans = async (): Promise<void> => {
  const names: Record<PlanKey, string> = { pilot: "Pilote", discovery: "Découverte", coach: "Coach", club: "Club" };
  await prisma.plan.createMany({
    data: (Object.keys(PLANS) as PlanKey[]).map((key) => ({ key, name: names[key], limits: PLANS[key].limits })),
    skipDuplicates: true,
  });
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
  // Un envoi sans fichier n'occupe rien : abandonné depuis 24 h, il ne compte plus dans le quota.
  const abandonedBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [maxAthletes, maxGroups, maxCoaches, videos, demonstrations] = await Promise.all([
    prisma.athlete.count({ where: { organizationId } }),
    prisma.group.count({ where: { organizationId } }),
    prisma.organizationMember.count({ where: { organizationId, role: { in: ["owner", "coach", "assistant"] } } }),
    prisma.video.count({
      where: {
        organizationId,
        createdAt: { gte: startOfMonth(now) },
        NOT: { muxAssetId: null, createdAt: { lt: abandonedBefore } },
      },
    }),
    prisma.exerciseMedia.count({
      where: {
        kind: "upload",
        exercise: { organizationId },
        createdAt: { gte: startOfMonth(now) },
        NOT: { muxAssetId: null, createdAt: { lt: abandonedBefore } },
      },
    }),
  ]);
  return { maxAthletes, maxGroups, maxCoaches, maxVideosPerMonth: videos + demonstrations };
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
  const [org, subscription, limits, usage, pendingCommands] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { plan: true, ownerId: true, stripeCustomerId: true, billingOwnerId: true, billingIssue: true },
    }),
    prisma.subscription.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
    limitsOf(organizationId),
    usageOf(organizationId),
    prisma.billingCommand.count({ where: { organizationId, state: "pending" } }),
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
    billingTransferred: Boolean(
      org.stripeCustomerId &&
      org.billingOwnerId &&
      org.billingOwnerId !== org.ownerId &&
      (pendingCommands > 0 || (subscription?.provider === "stripe" && subscription.status !== "canceled")),
    ),
    billingReview: Boolean(org.billingIssue),
    billingEnabled: billingEnabled() && env().BILLING_CHECKOUT_ENABLED === "true",
    hasCustomer:
      Boolean(org.stripeCustomerId) && (!org.billingOwnerId || org.billingOwnerId === userId) && !org.billingIssue,
  };
};

const INVOICE_FOOTER =
  "Yodev, Yoann Andrieux, entrepreneur individuel, SIREN 803 272 590. TVA non applicable, article 293 B du CGI.";

const LIVE_SUBSCRIPTIONS: readonly string[] = ["active", "trialing", "past_due", "incomplete", "unpaid", "paused"];

export const createCheckout = async (
  userId: string,
  organizationId: string,
  input: { plan: PlanKey; interval: BillingInterval },
): Promise<{ url: string }> => {
  await requireOrgMember(userId, organizationId, "manageSubscription");
  const price = priceIdFor(input.plan, input.interval);
  if (!billingEnabled() || !price || env().BILLING_CHECKOUT_ENABLED === "false")
    throw new AppError(503, "billing_disabled", m.billing.disabled);
  return withCheckoutIntent(organizationId, input, async (intent, leaseToken) => {
    let org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    if (org.ownerId !== userId) throw forbidden();
    if (org.billingIssue) throw new AppError(409, "billing_review", m.billing.checkoutReview);
    const remoteSubscriptions = org.stripeCustomerId ? await subscriptionsForCustomer(org.stripeCustomerId) : [];
    if (remoteSubscriptions.filter((s) => LIVE_SUBSCRIPTIONS.includes(s.status)).length > 1) {
      await reconcileStripeSubscription(organizationId);
      throw new AppError(409, "billing_review", m.billing.checkoutReview);
    }
    const closedSubscriptionIds = remoteSubscriptions.filter((s) => s.status === "canceled").map((s) => s.id);
    const currentBeforeTransfer = await prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    if (org.billingOwnerId && org.billingOwnerId !== userId) {
      const pending = await prisma.billingCommand.count({ where: { organizationId, state: "pending" } });
      if (
        pending ||
        remoteSubscriptions.some((s) => LIVE_SUBSCRIPTIONS.includes(s.status)) ||
        (currentBeforeTransfer?.provider === "stripe" && currentBeforeTransfer.status !== "canceled")
      ) {
        throw new AppError(409, "billing_transferred", m.billing.transferred);
      }
      org = await prisma.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId: null, billingOwnerId: null },
      });
    }
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } });
    // Un abonnement en cours se change depuis le portail : un second Checkout ferait payer deux fois.
    const current = await prisma.subscription.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } });
    if (current && current.status !== "canceled" && isPaidPlan(current.planKey as PlanKey)) {
      if (current.provider === "revenuecat") throw new AppError(409, "store_subscription", m.billing.storeHint);
      if (current.provider === "stripe" && org.stripeCustomerId) return createPortal(userId, organizationId);
    }
    const client = stripe();
    let customerId = org.stripeCustomerId;
    if (customerId) {
      // Un webhook perdu laisse la base en retard : Stripe fait foi, et deux onglets ne créent qu'un abonnement.
      if (remoteSubscriptions.some((subscription) => LIVE_SUBSCRIPTIONS.includes(subscription.status))) {
        await reconcileStripeSubscription(organizationId);
        return createPortal(userId, organizationId);
      }
      if (!intent.request) {
        // La migration peut trouver plusieurs sessions ouvertes. Aucun résultat partiel ne suffit.
        for (let page = 0; ; page++) {
          if (page === 10) throw new AppError(409, "billing_review", m.billing.checkoutReview);
          const result = await client.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
          for (const session of result.data) {
            const expired = await client.checkout.sessions.expire(session.id);
            if (expired.status !== "expired") throw new AppError(409, "billing_review", m.billing.checkoutReview);
          }
          if (!result.has_more) break;
        }
      }
    }
    if (!customerId) {
      const customer = await client.customers.create(
        {
          email: owner.email,
          name: org.name,
          metadata: { organizationId },
          preferred_locales: ["fr"],
          // Identité du vendeur et franchise en base de TVA : mentions obligatoires sur chaque facture.
          invoice_settings: { footer: INVOICE_FOOTER },
        },
        { idempotencyKey: `customer-${organizationId}-${userId}` },
      );
      customerId = customer.id;
      await prisma.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId: customerId, billingOwnerId: userId },
      });
    }
    // Un seul essai par propriétaire : ni résilier puis reprendre, ni ouvrir un autre espace ne le redonne.
    const alreadyPaid = await prisma.subscription.count({
      where: { organization: { ownerId: org.ownerId }, provider: { in: ["stripe", "revenuecat"] } },
    });
    const appUrl = env().NEXT_PUBLIC_APP_URL;
    return intentCheckout(
      intent,
      leaseToken,
      input,
      {
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
        custom_text: {
          submit: {
            message: `En validant, tu acceptes les conditions de vente (${appUrl}/cgv) et tu demandes que le service commence tout de suite. Si tu te rétractes sous 14 jours, le service déjà fourni reste dû.`,
          },
        },
        success_url: `${appUrl}/abonnement?merci=1`,
        cancel_url: `${appUrl}/abonnement`,
      },
      closedSubscriptionIds,
    );
  });
};

export const syncAfterCheckout = async (userId: string, organizationId: string): Promise<void> => {
  await requireOrgMember(userId, organizationId, "manageSubscription");
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { stripeCustomerId: true },
  });
  if (!billingEnabled() || !org.stripeCustomerId) return;
  // Sans réponse de Stripe, la page reste lisible : le webhook et la réconciliation prendront le relais.
  await reconcileStripeSubscription(organizationId).catch(() => log.warn("checkout_return_sync_failed"));
};

export const createPortal = async (userId: string, organizationId: string): Promise<{ url: string }> => {
  await requireOrgMember(userId, organizationId, "manageSubscription");
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { stripeCustomerId: true, billingOwnerId: true, billingIssue: true },
  });
  if (org.billingIssue) throw new AppError(409, "billing_review", m.billing.checkoutReview);
  if (org.billingOwnerId && org.billingOwnerId !== userId)
    throw new AppError(409, "billing_transferred", m.billing.transferred);
  if (!billingEnabled() || !org.stripeCustomerId) throw notFound();
  const session = await stripe().billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    locale: "fr",
    ...(env().STRIPE_PORTAL_CONFIGURATION_ID ? { configuration: env().STRIPE_PORTAL_CONFIGURATION_ID } : {}),
    return_url: `${env().NEXT_PUBLIC_APP_URL}/abonnement`,
  });
  return { url: session.url };
};

// Marqué après application : si la base tombe entre les deux, le renvoi du prestataire rejoue l'événement.
const alreadyProcessed = async (id: string): Promise<boolean> =>
  Boolean(await prisma.billingEvent.findUnique({ where: { id }, select: { id: true } }));

const markProcessed = async (id: string, provider: string, type: string): Promise<void> => {
  await prisma.billingEvent.createMany({ data: [{ id, provider, type }], skipDuplicates: true });
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

const NOTICE_WINDOW_DAYS = 21;
const NOTICE_INTERVAL_DAYS = 7;

const dateInParis = (date: Date): string =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(date);

// Prévient des vidéos qui entrent dans la fenêtre, au plus une fois par semaine pour un espace.
// La date du préavis n'est écrite qu'après l'acceptation par Resend : sans envoi, jamais de suppression.
const sendPurgeNotice = async (
  org: { id: string; name: string; owner: { email: string } },
  retentionDays: number,
  now: Date,
): Promise<void> => {
  const windowStart = new Date(now.getTime() - (retentionDays - NOTICE_WINDOW_DAYS) * DAY_MS);
  const videos = await prisma.video.findMany({
    where: { organizationId: org.id, purgeNoticeAt: null, createdAt: { lt: windowStart } },
    select: { id: true, createdAt: true },
  });
  if (videos.length === 0) return;
  const recent = await prisma.auditLog.findFirst({
    where: {
      organizationId: org.id,
      action: "video_purge_notice",
      at: { gte: new Date(now.getTime() - NOTICE_INTERVAL_DAYS * DAY_MS) },
    },
  });
  if (recent) return;
  const newest = videos.reduce((latest, video) => (video.createdAt > latest ? video.createdAt : latest), new Date(0));
  const limitDate = new Date(newest.getTime() + DAY_MS);
  const subject = m.billing.purge.subject(videos.length, org.name);
  try {
    await sendEmail({
      to: org.owner.email,
      subject,
      idempotencyKey: `purge-notice/${org.id}/${todayIso(now)}`,
      react: createElement(PurgeNoticeEmail, {
        subject,
        body: m.billing.purge.body(
          videos.length,
          org.name,
          dateInParis(limitDate),
          retentionDays,
          dateInParis(new Date(now.getTime() + PURGE_NOTICE_DAYS * DAY_MS)),
        ),
        cta: m.billing.purge.cta,
        url: `${env().NEXT_PUBLIC_APP_URL}/videos?espace=${org.id}`,
      }),
    });
  } catch {
    log.error("purge_notice_email_failed", { organizationId: org.id });
    return;
  }
  await prisma.video.updateMany({
    where: { id: { in: videos.map((video) => video.id) } },
    data: { purgeNoticeAt: now },
  });
  await prisma.auditLog.create({
    data: { organizationId: org.id, action: "video_purge_notice", entity: "video", at: now },
  });
};

// Conservation vidéo : coût maîtrisé (§ 17.1), jamais sans préavis réel d'au moins 14 jours.
export const purgeExpiredVideos = async (now: Date = new Date()): Promise<number> => {
  const orgs = await prisma.organization.findMany({
    where: { plan: { in: ["discovery", "coach", "club"] } },
    select: { id: true, name: true, plan: true, owner: { select: { email: true } } },
  });
  let purged = 0;
  for (const org of orgs) {
    const days = PLANS[org.plan].limits.videoRetentionDays;
    if (days === null) continue;
    await sendPurgeNotice(org, days, now);
    const { count } = await prisma.video.deleteMany({
      where: {
        organizationId: org.id,
        createdAt: { lt: new Date(now.getTime() - days * DAY_MS) },
        purgeNoticeAt: { lte: new Date(now.getTime() - PURGE_NOTICE_DAYS * DAY_MS) },
      },
    });
    purged += count;
  }
  if (purged) await drainExternalDeletions();
  log.info("videos_purged", { count: purged });
  return purged;
};

export const assertRevenueCatAuth = (header: string | null): void => {
  if (!hasBearer(header, env().REVENUECAT_WEBHOOK_AUTH)) throw invalid();
};
