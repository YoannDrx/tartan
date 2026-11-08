import {
  bypassesQuietHours,
  groupPublications,
  isQuietHours,
  QUIET_END_HOUR,
  type NotificationType,
  renderNotification,
  versionCode,
} from "@tartan/domain";
import type { NotificationsPage } from "@tartan/contracts";
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

export const registerDevice = async (
  userId: string,
  pushToken: string,
  platform: "ios" | "android" | "web",
  client: { appVersion?: string; updateId?: string | null; installationId?: string } = {},
) => {
  // Un ancien client n'envoie pas sa version : celle déjà connue n'est jamais effacée.
  const version = client.appVersion
    ? {
        appVersion: client.appVersion,
        appVersionCode: versionCode(client.appVersion),
        updateId: client.updateId ?? null,
        ...(client.installationId ? { installationId: client.installationId } : {}),
        lastSeenAt: new Date(),
      }
    : {};
  await prisma.device.upsert({
    where: { pushToken },
    create: { userId, pushToken, platform, ...version },
    update: { userId, platform, ...version },
  });
};

export const listNotifications = async (
  userId: string,
  query: { cursor?: string; limit?: number } = {},
): Promise<NotificationsPage> => {
  const limit = query.limit ?? 30;
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  const page = rows.slice(0, limit);
  return {
    items: page.map((n) => {
      const payload = n.payload as Payload;
      return {
        id: n.id,
        type: n.type,
        text: renderNotification(n.type as NotificationType, payload).body,
        link: payload.link ?? null,
        organizationId: payload.organizationId ?? null,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      };
    }),
    nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
    unread,
  };
};

export const markNotificationsRead = async (
  userId: string,
  input: { ids?: string[]; all?: true },
  now: Date = new Date(),
): Promise<void> => {
  await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(input.ids ? { id: { in: input.ids } } : {}) },
    data: { readAt: now },
  });
};

export const todayForNotifications = todayIso;
