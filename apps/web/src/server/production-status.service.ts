import { z } from "zod";
import { emailCatalog } from "../../emails/catalog";
import { env } from "@/lib/env";
import { forbidden, invalid } from "@/lib/errors";
import { sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { billingEnabled, stripe } from "@/lib/stripe";
import { STRIPE_WEBHOOK_EVENTS } from "@/lib/stripe-webhook-events";
import { isRootAdmin, requireAdmin } from "./admin.service";
import { reconcileStuckVideos } from "./video.service";

type Admin = { email: string; userId: string };
export type CheckState = "ok" | "todo" | "warning";
export type ProductionCheck = { key: string; state: CheckState; detail?: string };

const present = (value: string | null | undefined): CheckState => (value ? "ok" : "todo");

const stripeWebhookCheck = async (): Promise<ProductionCheck> => {
  const key = "stripeWebhook";
  if (!billingEnabled()) return { key, state: "todo" };
  try {
    const url = `${env().NEXT_PUBLIC_APP_URL}/api/webhooks/stripe`;
    const hooks = await stripe().webhookEndpoints.list({ limit: 100 });
    const hook = hooks.data.find((row) => row.url === url && row.status === "enabled");
    if (!hook) return { key, state: "todo" };
    const covered = STRIPE_WEBHOOK_EVENTS.filter((event) => hook.enabled_events.includes(event)).length;
    return {
      key,
      state: covered === STRIPE_WEBHOOK_EVENTS.length ? "ok" : "warning",
      detail: `${covered}/${STRIPE_WEBHOOK_EVENTS.length}`,
    };
  } catch {
    return { key, state: "warning" };
  }
};

// Présence seulement : aucune valeur de secret ne quitte le serveur.
export const productionStatus = async (actor: Admin) => {
  await requireAdmin(actor.email);
  const e = env();
  const stuckBefore = new Date(Date.now() - 60 * 60 * 1000);
  const [stripeWebhook, stuckVideos, passkeys] = await Promise.all([
    stripeWebhookCheck(),
    prisma.video.count({ where: { status: { in: ["uploading", "processing"] }, updatedAt: { lt: stuckBefore } } }),
    prisma.passkey.count({ where: { userId: actor.userId } }),
  ]);
  const checks: ProductionCheck[] = [
    { key: "openai", state: present(e.OPENAI_API_KEY ?? e.OPEN_AI_API_KEY) },
    { key: "resend", state: present(e.RESEND_API_KEY), detail: e.EMAIL_FROM },
    { key: "resendWebhook", state: present(e.RESEND_WEBHOOK_SECRET) },
    { key: "stripe", state: present(e.STRIPE_SECRET_KEY) },
    stripeWebhook,
    { key: "mux", state: present(e.MUX_TOKEN_ID && e.MUX_TOKEN_SECRET) },
    { key: "muxWebhook", state: present(e.MUX_WEBHOOK_SECRET) },
    { key: "stuckVideos", state: stuckVideos ? "warning" : "ok", detail: String(stuckVideos) },
    { key: "cronHourly", state: present(e.CRON_HEARTBEAT_URL) },
    { key: "cronNotifications", state: present(e.CRON_HEARTBEAT_NOTIFICATIONS_URL) },
    { key: "passkey", state: passkeys ? "ok" : "todo", detail: String(passkeys) },
    { key: "bootstrapToken", state: e.ADMIN_BOOTSTRAP_TOKEN ? "warning" : "ok" },
    { key: "webPush", state: present(e.NEXT_PUBLIC_VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY) },
    { key: "universalLinks", state: present(process.env.APPLE_TEAM_ID) },
    { key: "androidLinks", state: present(process.env.ANDROID_SHA256_FINGERPRINTS) },
    { key: "sentry", state: present(process.env.NEXT_PUBLIC_SENTRY_DSN) },
  ];
  return { checks };
};

const normalize = (email: string) => email.trim().toLowerCase();
const emailInput = z.email().transform(normalize);

export const listPlatformAdmins = async (actor: Admin) => {
  await requireAdmin(actor.email);
  const roots = env().ADMIN_EMAILS.split(",").map(normalize).filter(Boolean);
  const rows = await prisma.platformAdmin.findMany({ orderBy: { createdAt: "asc" } });
  return {
    canManage: isRootAdmin(actor.email),
    roots,
    others: rows.filter((row) => !roots.includes(row.email)).map(({ email, enrollUntil }) => ({ email, enrollUntil })),
  };
};

const ENROLL_MS = 24 * 60 * 60 * 1000;

// Seule une adresse racine (ADMIN_EMAILS) nomme ou retire : un administrateur ajouté ne peut pas évincer les autres.
export const addPlatformAdmin = async (actor: Admin, email: unknown) => {
  if (!isRootAdmin(actor.email)) throw forbidden();
  const parsed = emailInput.safeParse(email);
  if (!parsed.success) throw invalid();
  const enrollUntil = new Date(Date.now() + ENROLL_MS);
  await prisma.$transaction([
    prisma.platformAdmin.upsert({
      where: { email: parsed.data },
      create: { email: parsed.data, enrollUntil, addedById: actor.userId },
      update: { enrollUntil },
    }),
    prisma.auditLog.create({
      data: { actorId: actor.userId, action: "platform_admin_added", entity: "platform_admin", entityId: parsed.data },
    }),
  ]);
};

export const removePlatformAdmin = async (actor: Admin, email: unknown) => {
  if (!isRootAdmin(actor.email)) throw forbidden();
  const parsed = emailInput.safeParse(email);
  if (!parsed.success) throw invalid();
  await prisma.$transaction([
    prisma.platformAdmin.deleteMany({ where: { email: parsed.data } }),
    prisma.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "platform_admin_removed",
        entity: "platform_admin",
        entityId: parsed.data,
      },
    }),
  ]);
};

export const adminCanEnroll = async (email: string): Promise<boolean> => {
  const row = await prisma.platformAdmin.findUnique({ where: { email: normalize(email) } });
  return Boolean(row?.enrollUntil && row.enrollUntil > new Date());
};

// Le catalogue complet avec des données fictives : Resend limite à deux envois par seconde.
export const sendTestEmails = async (actor: Admin, input: { to: string; key: string }) => {
  await requireAdmin(actor.email);
  const samples = emailCatalog(env().NEXT_PUBLIC_APP_URL).filter(
    (sample) => input.key === "all" || sample.key === input.key,
  );
  if (!samples.length) throw invalid();
  let sent = 0;
  for (const sample of samples) {
    await sendEmail({ kind: sample.key, to: input.to, subject: `[Essai] ${sample.subject}`, react: sample.react });
    sent += 1;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  await prisma.auditLog.create({
    data: {
      actorId: actor.userId,
      action: "test_emails_sent",
      entity: "email",
      metadata: { count: sent, key: input.key },
    },
  });
  return { sent };
};

export const emailSampleKeys = () => emailCatalog("https://app.tartan.coach").map((sample) => sample.key);

export const adminReconcileVideos = async (actor: Admin) => {
  await requireAdmin(actor.email);
  const result = await reconcileStuckVideos();
  await prisma.auditLog.create({
    data: { actorId: actor.userId, action: "videos_reconciled", entity: "video", metadata: result },
  });
  return result;
};
