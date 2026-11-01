import {
  bypassesQuietHours,
  groupPublications,
  isQuietHours,
  QUIET_END_HOUR,
  type NotificationType,
  renderNotification,
} from "@tartan/domain";
import webpush from "web-push";
import { env } from "@/lib/env";
import { hourInParis, todayIso } from "@/lib/dates";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export type NotificationVars = Parameters<typeof renderNotification>[1];

type Payload = NotificationVars & { link?: string; organizationId?: string; sessionId?: string; videoId?: string };

const CHANNELS: Record<NotificationType, string> = {
  session_published: "seances",
  session_batch_published: "seances",
  session_eve: "seances",
  session_autonomous: "seances",
  session_reminder: "seances",
  session_updated: "seances",
  announcement: "seances",
  video_shared: "videos",
  comment: "videos",
  pain_alert: "alertes-coach",
  missed_streak: "alertes-coach",
};

const nextMorning = (now: Date): Date => {
  const hour = hourInParis(now);
  const hoursToWait = hour >= QUIET_END_HOUR ? 24 - hour + QUIET_END_HOUR : QUIET_END_HOUR - hour;
  return new Date(now.getTime() + hoursToWait * 3600 * 1000);
};

// Écrit l'historique in-app ; l'envoi part tout de suite, ou à 7 h pendant les heures calmes.
export const notify = async (
  userIds: string[],
  type: NotificationType,
  payload: Payload,
  now: Date = new Date(),
): Promise<void> => {
  const targets = [...new Set(userIds)];
  if (targets.length === 0) return;
  const quiet = isQuietHours(hourInParis(now)) && !bypassesQuietHours(type);
  await prisma.notification.createMany({
    data: targets.map((userId) => ({
      userId,
      type,
      payload,
      deliverAfter: quiet ? nextMorning(now) : now,
    })),
  });
  if (!quiet) await dispatchPending(now);
};

export const notifyPublications = async (
  entries: { userId: string; date: string }[],
  payload: Payload,
): Promise<void> => {
  for (const group of groupPublications(entries)) {
    const first = group.dates[0];
    if (group.dates.length > 1) {
      await notify([group.userId], "session_batch_published", { ...payload, count: group.dates.length });
    } else if (first) {
      await notify([group.userId], "session_published", { ...payload, date: first });
    }
  }
};

const sendExpo = async (messages: unknown[]): Promise<boolean> => {
  const token = env().EXPO_ACCESS_TOKEN;
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) log.error("push_expo_failed", { status: String(res.status) });
  return res.ok;
};

// Le web garde l'espace dans le lien : un compte coach et athlète ouvre la bonne page.
export const webLink = (link: string | undefined, organizationId: string | undefined): string | undefined => {
  if (!link || !organizationId) return link;
  return `${link}${link.includes("?") ? "&" : "?"}espace=${organizationId}`;
};

export const unregisterDevice = async (userId: string, pushToken: string): Promise<void> => {
  await prisma.device.deleteMany({ where: { userId, pushToken } });
};

const sendWeb = async (subscription: string, body: string): Promise<boolean> => {
  const e = env();
  if (!e.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !e.VAPID_PRIVATE_KEY) return true;
  try {
    webpush.setVapidDetails(e.VAPID_SUBJECT, e.NEXT_PUBLIC_VAPID_PUBLIC_KEY, e.VAPID_PRIVATE_KEY);
    await webpush.sendNotification(JSON.parse(subscription), body);
    return true;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status !== 404 && status !== 410) log.error("push_web_failed", { status: String(status) });
    return status !== 404 && status !== 410;
  }
};

export const dispatchPending = async (now: Date = new Date()): Promise<number> => {
  const pending = await prisma.notification.findMany({
    where: { sentAt: null, OR: [{ deliverAfter: null }, { deliverAfter: { lte: now } }] },
    take: 500,
    orderBy: { createdAt: "asc" },
  });
  if (pending.length === 0) return 0;
  const devices = await prisma.device.findMany({ where: { userId: { in: pending.map((p) => p.userId) } } });
  const expoMessages: { notificationId: string; message: unknown }[] = [];
  const staleDevices: string[] = [];
  for (const n of pending) {
    const payload = n.payload as Payload;
    const type = n.type as NotificationType;
    const text = renderNotification(type, payload);
    for (const device of devices.filter((d) => d.userId === n.userId)) {
      if (device.platform === "web") {
        const ok = await sendWeb(
          device.pushToken,
          JSON.stringify({ ...text, link: webLink(payload.link, payload.organizationId) }),
        );
        if (!ok) staleDevices.push(device.id);
      } else {
        expoMessages.push({
          notificationId: n.id,
          message: {
            to: device.pushToken,
            title: text.title,
            body: text.body,
            sound: "default",
            channelId: CHANNELS[type],
            priority: type === "pain_alert" ? "high" : "default",
            categoryId: type === "session_eve" ? "attendance" : type === "session_reminder" ? "validate" : undefined,
            data: {
              type,
              link: payload.link,
              organizationId: payload.organizationId,
              sessionId: payload.sessionId,
              videoId: payload.videoId,
            },
          },
        });
      }
    }
  }
  // Expo indisponible : la notification repart à la prochaine tâche, pendant quelques heures au plus.
  const failed = new Set<string>();
  for (let i = 0; i < expoMessages.length; i += 100) {
    const batch = expoMessages.slice(i, i + 100);
    if (!(await sendExpo(batch.map((b) => b.message)))) for (const b of batch) failed.add(b.notificationId);
  }
  const retryUntil = now.getTime() - 6 * 60 * 60 * 1000;
  const done = pending.filter((p) => !failed.has(p.id) || p.createdAt.getTime() < retryUntil);
  if (staleDevices.length) await prisma.device.deleteMany({ where: { id: { in: staleDevices } } });
  await prisma.notification.updateMany({
    where: { id: { in: done.map((p) => p.id) } },
    data: { sentAt: now },
  });
  log.info("notifications_dispatched", { count: pending.length });
  return pending.length;
};

export const registerDevice = async (userId: string, pushToken: string, platform: "ios" | "android" | "web") => {
  await prisma.device.upsert({
    where: { pushToken },
    create: { userId, pushToken, platform },
    update: { userId, platform },
  });
};

export const listNotifications = async (userId: string) => {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    text: renderNotification(n.type as NotificationType, n.payload as Payload).body,
    link: (n.payload as Payload).link ?? null,
    readAt: n.readAt,
    createdAt: n.createdAt,
  }));
};

export const todayForNotifications = todayIso;
