import { createElement } from "react";
import type Stripe from "stripe";
import { discountedMonthlyCents, monthlyCents } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { NotificationEmail } from "@email/auth";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { enqueuePaymentActionRequired } from "./email-outbox.service";

const fromUnix = (value: number | null | undefined) => (value ? new Date(value * 1000) : null);
const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);

export const sendFounderAlert = async (subject: string): Promise<void> => {
  const recipients = env()
    .ADMIN_EMAILS.split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject,
        react: createElement(NotificationEmail, { body: subject, url: `${env().NEXT_PUBLIC_APP_URL}/admin` }),
      }),
    ),
  );
};

const organizationForCustomer = async (customer: string | null) =>
  customer
    ? prisma.organization.findUnique({ where: { stripeCustomerId: customer }, select: { id: true, name: true } })
    : null;

// Liste et agrégats lisent ce miroir ; tout geste sur l'argent relit Stripe.
export const syncInvoice = async (invoiceId: string): Promise<void> => {
  const invoice = await stripe().invoices.retrieve(invoiceId, { expand: ["payments.data.payment.payment_intent"] });
  const org = await organizationForCustomer(idOf(invoice.customer));
  const payment = invoice.payments?.data[0]?.payment;
  const intent = payment?.payment_intent;
  const paymentIntentId = idOf(intent);
  const chargeId = idOf(payment?.charge) ?? (typeof intent === "object" && intent ? idOf(intent.latest_charge) : null);
  const taxCents = invoice.total - (invoice.total_excluding_tax ?? invoice.total);
  const discountCents = (invoice.total_discount_amounts ?? []).reduce((total, row) => total + row.amount, 0);
  const data = {
    livemode: invoice.livemode,
    organizationId: org?.id ?? null,
    stripeCustomerId: idOf(invoice.customer) ?? "",
    stripeSubscriptionId: idOf(invoice.parent?.subscription_details?.subscription),
    paymentIntentId,
    chargeId,
    number: invoice.number,
    status: invoice.status ?? "draft",
    currency: invoice.currency,
    totalCents: invoice.total,
    amountPaidCents: invoice.amount_paid,
    taxCents,
    discountCents,
    refundedCents: invoice.post_payment_credit_notes_amount,
    periodStart: fromUnix(invoice.period_start),
    periodEnd: fromUnix(invoice.period_end),
    paidAt: fromUnix(invoice.status_transitions?.paid_at),
    stripeCreatedAt: fromUnix(invoice.created) ?? new Date(),
    syncedAt: new Date(),
  };
  await prisma.billingInvoice.upsert({ where: { id: invoice.id }, create: { id: invoice.id, ...data }, update: data });
};

const syncDispute = async (dispute: Stripe.Dispute, alertOnCreate: boolean) => {
  const chargeId = idOf(dispute.charge) ?? "";
  const charge = chargeId ? await stripe().charges.retrieve(chargeId) : null;
  const org = await organizationForCustomer(idOf(charge?.customer));
  if (!org) return;
  const data = {
    livemode: dispute.livemode,
    chargeId,
    organizationId: org.id,
    amountCents: dispute.amount,
    status: dispute.status,
    reason: dispute.reason,
    dueBy: fromUnix(dispute.evidence_details?.due_by),
    syncedAt: new Date(),
  };
  await prisma.billingDispute.upsert({ where: { id: dispute.id }, create: { id: dispute.id, ...data }, update: data });
  if (alertOnCreate) await sendFounderAlert(m.admin.alerts.dispute(org.name)).catch(() => undefined);
};

const liveKey = () => (env().STRIPE_SECRET_KEY ?? "").includes("_live_");

// Le compte peut porter d'autres produits : tout client non rattaché à un espace est ignoré.
export const handleMirrorEvent = async (event: Stripe.Event): Promise<void> => {
  if (event.livemode !== liveKey()) return;
  if (await prisma.billingEvent.findUnique({ where: { id: event.id } })) return;
  if (event.type.startsWith("invoice.")) {
    const invoice = event.data.object as Stripe.Invoice;
    const org = await organizationForCustomer(idOf(invoice.customer));
    if (org && invoice.id) {
      await syncInvoice(invoice.id);
      if (event.type === "invoice.payment_failed") {
        await sendFounderAlert(m.admin.alerts.paymentFailed(org.name)).catch(() => undefined);
      }
      // La banque demande une validation : le payeur est prévenu, la file reprend l'envoi s'il échoue.
      if (event.type === "invoice.payment_action_required") await enqueuePaymentActionRequired(org.id, invoice.id);
    }
  } else if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    await prisma.billingInvoice.updateMany({
      where: { chargeId: charge.id },
      data: { refundedCents: charge.amount_refunded, syncedAt: new Date() },
    });
  } else if (event.type === "refund.failed") {
    const refund = event.data.object as Stripe.Refund;
    const updated = await prisma.billingRefund.updateMany({
      where: { stripeRefundId: refund.id },
      data: { state: "review", lastErrorCode: "stripe_refund_failed" },
    });
    if (updated.count) await sendFounderAlert(m.admin.alerts.refundReview).catch(() => undefined);
  } else if (event.type.startsWith("charge.dispute.")) {
    await syncDispute(event.data.object as Stripe.Dispute, event.type === "charge.dispute.created");
  } else {
    return;
  }
  await prisma.billingEvent.createMany({
    data: [{ id: event.id, provider: "stripe", type: event.type }],
    skipDuplicates: true,
  });
  log.info("stripe_mirror_event", { code: event.type });
};

const discountOf = (subscription: Stripe.Subscription) => {
  const first = subscription.discounts?.[0];
  if (!first || typeof first === "string") return null;
  const coupon = first.source?.coupon;
  if (!coupon || typeof coupon === "string") return null;
  return {
    discount: { percentOff: coupon.percent_off, amountOff: coupon.amount_off, duration: coupon.duration },
    endsAt: fromUnix(first.end),
  };
};

// Colonnes de revenu, recalculées à chaque rapprochement : y compris quand rien d'autre n'a changé.
export const subscriptionRevenueColumns = (subscription: Stripe.Subscription) => {
  const price = subscription.items.data[0]?.price;
  const interval = price?.recurring?.interval === "year" ? ("year" as const) : ("month" as const);
  const unit = price?.unit_amount ?? 0;
  const list = monthlyCents(unit, interval);
  const discount = discountOf(subscription);
  return {
    interval,
    listMrrCents: list,
    discountedMrrCents: discountedMonthlyCents(list, discount?.discount ?? null),
    discountEndsAt: discount?.endsAt ?? null,
    trialEndsAt: fromUnix(subscription.trial_end),
    canceledAt: fromUnix(subscription.canceled_at),
    startedAt: fromUnix(subscription.start_date),
  };
};
