import {
  bypassesQuietHours,
  groupPublications,
  isQuietHours,
  QUIET_END_HOUR,
  type NotificationType,
  renderNotification,
} from "@tartan/domain";
import type { Prisma } from "@/generated/prisma/client";
import { hourInParis, todayIso } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { dispatchPending } from "./notification-delivery.service";
export { dispatchPending, webLink } from "./notification-delivery.service";

export type NotificationVars = Parameters<typeof renderNotification>[1];

type Payload = NotificationVars & { link?: string; organizationId?: string; sessionId?: string; videoId?: string };

const nextMorning = (now: Date): Date => {
  const hour = hourInParis(now);
  const hoursToWait = hour >= QUIET_END_HOUR ? 24 - hour + QUIET_END_HOUR : QUIET_END_HOUR - hour;
  return new Date(now.getTime() + hoursToWait * 3600 * 1000);
};

// File transactionnelle : aucune livraison réseau avant la validation des données métier.
export const queueNotifications = async (
  db: Prisma.TransactionClient,
  userIds: string[],
  type: NotificationType,
  payload: Payload,
  now: Date = new Date(),
): Promise<string[]> => {
  const targets = [...new Set(userIds)];
  if (targets.length === 0) return [];
  const quiet = isQuietHours(hourInParis(now)) && !bypassesQuietHours(type);
  const notifications = await db.notification.createManyAndReturn({
    data: targets.map((userId) => ({ userId, type, payload, deliverAfter: quiet ? nextMorning(now) : now })),
    select: { id: true },
  });
  return notifications.map((n) => n.id);
};

// Écrit l'historique in-app ; dispatchPending respecte la date de livraison et les heures calmes.
export const notify = async (
  userIds: string[],
  type: NotificationType,
  payload: Payload,
  now: Date = new Date(),
): Promise<void> => {
  const ids = await queueNotifications(prisma, userIds, type, payload, now);
  if (ids.length) await dispatchPending(now, ids);
};

// Plusieurs séances publiées d'un coup = une seule notification, qui ouvre la journée (§ 13.2).
export const notifyPublications = async (
  entries: { userId: string; date: string; sessionId: string }[],
  payload: Payload,
): Promise<void> => {
  for (const group of groupPublications(entries)) {
    const first = group.dates[0];
    if (group.dates.length > 1) {
      await notify([group.userId], "session_batch_published", {
        ...payload,
        count: group.dates.length,
        link: "/accueil",
      });
    } else if (first) {
      const sessionId = entries.find((e) => e.userId === group.userId)?.sessionId;
      await notify([group.userId], "session_published", {
        ...payload,
        date: first,
        sessionId,
        link: `/seance/${sessionId}`,
      });
    }
  }
};

export const unregisterDevice = async (userId: string, pushToken: string): Promise<void> => {
  await prisma.device.deleteMany({ where: { userId, pushToken } });
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
