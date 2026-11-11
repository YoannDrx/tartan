import { randomUUID } from "node:crypto";
import { Link } from "@react-email/components";
import { createElement, Fragment } from "react";
import { notificationCategory, renderNotification, type NotificationType } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { NotificationEmail } from "@email/auth";
import { unsubscribePageUrl, unsubscribeUrl } from "./email-preferences.service";
import type { Notification, NotificationDelivery } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  readExpoReceipt,
  sendExpoNotification,
  sendWebNotification,
  type DeliveryResult,
} from "@/lib/notification-transport";

type Payload = Parameters<typeof renderNotification>[1] & {
  platform?: string;
  versionCode?: number;
  link?: string;
  organizationId?: string;
  sessionId?: string;
  videoId?: string;
};
type Delivery = NotificationDelivery & { notification: Notification };
const MINUTE = 60_000;
const PENDING = ["pending", "receipt"];
const EMAIL_FALLBACK: ReadonlySet<string> = new Set([
  "session_published",
  "session_batch_published",
  "session_eve",
  "session_autonomous",
  "session_updated",
  "session_cancelled",
  "scheduled_publication_blocked",
  "video_shared",
  "pain_alert",
  "missed_streak",
  "announcement",
]);
const CHANNELS: Record<NotificationType, string> = {
  session_published: "seances",
  session_batch_published: "seances",
  session_eve: "seances",
  session_autonomous: "seances",
  session_reminder: "seances",
  session_updated: "seances",
  session_cancelled: "seances",
  scheduled_publication_blocked: "seances",
  announcement: "seances",
  video_shared: "videos",
  comment: "videos",
  pain_alert: "alertes-coach",
  missed_streak: "alertes-coach",
  member_joined: "seances",
  app_update: "mises-a-jour",
};

export const webLink = (link: string | undefined, organizationId: string | undefined): string | undefined => {
  if (!link || !organizationId) return link;
  return `${link}${link.includes("?") ? "&" : "?"}espace=${organizationId}`;
};

const webActions = (type: NotificationType, payload: Payload) => {
  if (type !== "session_eve" || !payload.organizationId || !payload.sessionId) return {};
  const path = `/api/v1/orgs/${payload.organizationId}/sessions/${payload.sessionId}/attendance`;
  return {
    actions: [
      { action: "present", title: m.today.attendanceYes },
      { action: "absent", title: m.today.attendanceNo },
    ],
    api: { present: { path, body: { status: "present" } }, absent: { path, body: { status: "absent" } } },
  };
};

// Le délai commence à l'heure de livraison prévue, pas pendant les heures calmes.
const deadline = (n: Notification, channel: string) =>
  (n.deliverAfter ?? n.createdAt).getTime() + (channel === "email" ? 24 : 6) * 60 * MINUTE;

const initialize = async (notification: Notification, now: Date) => {
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.notification.updateMany({
      where: { id: notification.id, deliveryInitializedAt: null, sentAt: null, deliveryCompletedAt: null },
      data: { deliveryInitializedAt: now },
    });
    if (!claimed.count) return;
    const type = notification.type as NotificationType;
    const category = notificationCategory(type);
    const profile = await tx.profile.findUnique({
      where: { id: notification.userId },
      select: { pushSessions: true, pushFeedback: true, pushGroup: true, pushProductUpdates: true },
    });
    const allowed =
      category === "alerts" ||
      !profile ||
      (category === "sessions" && profile.pushSessions) ||
      (category === "feedback" && profile.pushFeedback) ||
      (category === "group" && profile.pushGroup) ||
      (category === "product" && profile.pushProductUpdates);
    // Catégorie coupée : le message reste dans le centre de notifications, rien n'est envoyé.
    if (!allowed) {
      await tx.notification.update({ where: { id: notification.id }, data: { deliveryCompletedAt: now } });
      return;
    }
    const payload = notification.payload as Payload;
    const all = await tx.device.findMany({ where: { userId: notification.userId } });
    // Une mise à jour ne vise que la plateforme concernée et les appareils encore en retard.
    const devices =
      type === "app_update"
        ? all.filter(
            (d) =>
              d.platform === payload.platform &&
              (d.appVersionCode === null || d.appVersionCode < (payload.versionCode ?? 0)),
          )
        : all;
    if (devices.length) {
      await tx.notificationDelivery.createMany({
        data: devices.map((d) => ({
          notificationId: notification.id,
          targetKey: d.id,
          deviceId: d.id,
          channel: d.platform === "web" ? "web" : "expo",
          nextAttemptAt: now,
        })),
        skipDuplicates: true,
      });
    } else if (EMAIL_FALLBACK.has(notification.type)) {
      await tx.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          targetKey: "email",
          channel: "email",
          nextAttemptAt: now,
        },
      });
    }
  });
};

const send = async (delivery: Delivery): Promise<DeliveryResult | { state: "skipped"; code: string }> => {
  const n = delivery.notification;
  const payload = n.payload as Payload;
  const type = n.type as NotificationType;
  const text = renderNotification(type, payload);
  if (delivery.channel === "email") {
    const user = await prisma.user.findUnique({
      where: { id: n.userId },
      select: { email: true, profile: { select: { emailNotifications: true } } },
    });
    if (!user) return { state: "skipped", code: "account_deleted" };
    // Le message reste dans l'app : seul l'e-mail de repli est coupé.
    if (user.profile?.emailNotifications === false) return { state: "skipped", code: "email_opt_out" };
    // Une configuration absente en production ne doit pas fabriquer un succès dans une boîte en mémoire.
    if (process.env.NODE_ENV === "production" && !env().RESEND_API_KEY)
      return { state: "retry", code: "email_unconfigured" };
    try {
      await sendEmail({
        kind: "notification_fallback",
        to: user.email,
        subject: text.body,
        idempotencyKey: `notification/${delivery.id}`,
        unsubscribeUrl: unsubscribeUrl(n.userId, "notifications"),
        react: createElement(NotificationEmail, {
          body: text.body,
          cta: m.email.cta[type],
          footerNote: createElement(
            Fragment,
            null,
            `${m.email.fallbackFooter} `,
            createElement(Link, { href: unsubscribePageUrl(n.userId, "notifications") }, m.email.unsubscribeLink),
          ),
          url: `${env().NEXT_PUBLIC_APP_URL}${webLink(payload.link, payload.organizationId) ?? "/accueil"}`,
        }),
      });
      return { state: "accepted" };
    } catch {
      return { state: "retry", code: "email_failed" };
    }
  }
  // Un appareil déconnecté ou passé à un autre compte ne reçoit jamais l'ancien message.
  const device = await prisma.device.findFirst({ where: { id: delivery.deviceId ?? "", userId: n.userId } });
  if (!device) return { state: "skipped", code: "device_detached" };
  if (type === "app_update" && device.appVersionCode !== null && device.appVersionCode >= (payload.versionCode ?? 0)) {
    return { state: "skipped", code: "already_updated" };
  }
  let result: DeliveryResult;
  if (delivery.state === "receipt" && delivery.receiptId) {
    result = await readExpoReceipt(delivery.receiptId);
  } else if (delivery.channel === "web") {
    result = await sendWebNotification(
      device.pushToken,
      JSON.stringify({
        ...text,
        link: webLink(payload.link, payload.organizationId),
        ...webActions(type, payload),
      }),
    );
  } else {
    result = await sendExpoNotification({
      to: device.pushToken,
      title: text.title,
      body: text.body,
      sound: "default",
      // Le canal des mises à jour n'existe pas sur un binaire antérieur au suivi des versions.
      channelId: type === "app_update" && !device.appVersion ? "seances" : CHANNELS[type],
      priority: type === "pain_alert" ? "high" : "default",
      categoryId: type === "session_eve" ? "attendance" : type === "session_reminder" ? "validate" : undefined,
      data: {
        // Aucune indication de santé ne part vers Expo, Apple ou Google. L'app ne route pas sur ce type.
        type: type === "pain_alert" || type === "missed_streak" ? "alert" : type,
        link: payload.link,
        organizationId: payload.organizationId,
        sessionId: payload.sessionId,
        videoId: payload.videoId,
      },
    });
  }
  if (result.state === "invalid") {
    await prisma.device.deleteMany({ where: { id: device.id, userId: n.userId, pushToken: device.pushToken } });
  }
  return result;
};

const attempt = async (delivery: Delivery, now: Date) => {
  const leaseToken = randomUUID();
  const claimed = await prisma.notificationDelivery.updateMany({
    where: {
      id: delivery.id,
      state: { in: PENDING },
      nextAttemptAt: { lte: now },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    },
    data: { leaseToken, leaseUntil: new Date(now.getTime() + 2 * MINUTE), attempts: { increment: 1 } },
  });
  if (!claimed.count) return;
  const expires = deadline(delivery.notification, delivery.channel);
  const result =
    now.getTime() >= expires
      ? { state: "failed" as const, code: delivery.errorCode ?? "delivery_expired" }
      : await send(delivery);
  const retry = result.state === "retry";
  const receipt = result.state === "receipt" || (retry && result.poll);
  const nextDelay = receipt ? 15 * MINUTE : Math.min(60, 2 ** Math.min(delivery.attempts, 6)) * MINUTE;
  const state = retry ? (receipt ? "receipt" : "pending") : result.state === "invalid" ? "failed" : result.state;
  await prisma.notificationDelivery.updateMany({
    where: { id: delivery.id, leaseToken },
    data: {
      state,
      leaseToken: null,
      leaseUntil: null,
      nextAttemptAt: new Date(Math.min(expires, now.getTime() + nextDelay)),
      receiptId: result.state === "receipt" ? result.receiptId : receipt ? delivery.receiptId : null,
      acceptedAt: result.state === "accepted" ? now : null,
      errorCode: "code" in result ? result.code : null,
    },
  });
  if ("code" in result && result.state !== "skipped") {
    log.warn("notification_delivery_problem", { code: result.code, entityId: delivery.id });
  }
};

// Sérialise la décision de repli et la clôture ; l'envoi réseau reste hors transaction.
const settle = async (id: string, now: Date) => {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM notifications WHERE id = ${id}::uuid FOR UPDATE`;
    const n = await tx.notification.findUnique({ where: { id }, include: { deliveries: true } });
    if (!n || !n.deliveryInitializedAt || n.deliveryCompletedAt || n.sentAt) return;
    if (n.deliveries.some((d) => PENDING.includes(d.state))) return;
    const accepted = n.deliveries.some((d) => d.state === "accepted");
    if (!accepted && EMAIL_FALLBACK.has(n.type) && !n.deliveries.some((d) => d.channel === "email")) {
      await tx.notificationDelivery.create({
        data: { notificationId: id, targetKey: "email", channel: "email", nextAttemptAt: now },
      });
      return;
    }
    // « Terminé » ne signifie jamais « reçu » : sans canal accepté, sentAt reste vide.
    await tx.notification.update({ where: { id }, data: { deliveryCompletedAt: now, sentAt: accepted ? now : null } });
  });
};

export const dispatchPending = async (now = new Date(), notificationIds?: string[]): Promise<number> => {
  const scope = notificationIds ? { id: { in: notificationIds } } : {};
  const pending = await prisma.notification.findMany({
    where: {
      ...scope,
      deliveryInitializedAt: null,
      deliveryCompletedAt: null,
      sentAt: null,
      OR: [{ deliverAfter: null }, { deliverAfter: { lte: now } }],
    },
    take: 100,
    orderBy: { createdAt: "asc" },
  });
  const touched = new Set(pending.map((n) => n.id));
  for (const n of pending) await initialize(n, now);
  // Reprise après un arrêt entre l'enregistrement du résultat et la clôture du message.
  const unfinished = await prisma.notification.findMany({
    where: {
      ...scope,
      deliveryInitializedAt: { not: null },
      deliveryCompletedAt: null,
      sentAt: null,
      deliveries: { none: { state: { in: PENDING } } },
    },
    select: { id: true },
    take: 100,
    orderBy: { createdAt: "asc" },
  });
  for (const n of unfinished) {
    touched.add(n.id);
    await settle(n.id, now);
  }
  // Deux passages permettent le repli e-mail immédiatement après un jeton invalide.
  for (let round = 0; round < 2; round++) {
    const due = await prisma.notificationDelivery.findMany({
      where: {
        state: { in: PENDING },
        nextAttemptAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
        notification: { ...scope, deliveryCompletedAt: null, sentAt: null },
      },
      include: { notification: true },
      take: 100,
      orderBy: { nextAttemptAt: "asc" },
    });
    for (let i = 0; i < due.length; i += 10) {
      await Promise.all(
        due.slice(i, i + 10).map(async (d) => {
          touched.add(d.notificationId);
          await attempt(d, now);
        }),
      );
    }
    for (const id of touched) await settle(id, now);
  }
  if (touched.size) log.info("notifications_dispatched", { count: touched.size });
  return touched.size;
};

// Agrégats techniques uniquement : aucun destinataire, jeton ni contenu dans la supervision.
export const notificationDeliveryHealth = async (now = new Date()) => {
  const since = new Date(now.getTime() - 24 * 60 * MINUTE);
  const lateSince = new Date(now.getTime() - 30 * MINUTE);
  const [pending, late, failedLast24h, undeliveredLast24h] = await Promise.all([
    prisma.notificationDelivery.count({ where: { state: { in: PENDING } } }),
    prisma.notificationDelivery.count({ where: { state: { in: PENDING }, nextAttemptAt: { lte: lateSince } } }),
    prisma.notificationDelivery.count({ where: { state: "failed", updatedAt: { gte: since } } }),
    prisma.notification.count({
      where: { sentAt: null, deliveryCompletedAt: { gte: since }, deliveries: { some: {} } },
    }),
  ]);
  return { pending, late, failedLast24h, undeliveredLast24h };
};
