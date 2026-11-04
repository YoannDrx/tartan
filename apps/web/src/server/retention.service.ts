import { createElement } from "react";
import { m } from "@tartan/i18n";
import { InactivityNoticeEmail } from "@email/auth";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { deleteAccount } from "./account.service";
import { deleteAthleteAssignments } from "./session-audience.service";

const DAY_MS = 86_400_000;
const BATCH = 1000;

// Le tableau publié dans la politique de confidentialité : à modifier ensemble.
export const RETENTION_DAYS = {
  auditLog: 365,
  notification: 90,
  invitationContact: 30,
  expiredAuth: 1,
  rateLimit: 7,
  resolvedReport: 365,
  billingEvent: 395,
  finishedDeletion: 90,
  inactiveAccount: 730,
  inactivityNotice: 30,
  sheetWithoutAccount: 365,
} as const;

const ago = (now: Date, days: number): Date => new Date(now.getTime() - days * DAY_MS);

// Un lot par passage : une longue purge se répartit sur plusieurs jours sans bloquer la tâche horaire.
const purgeBatch = async <T extends { id: string | number }>(
  find: () => Promise<T[]>,
  remove: (ids: T["id"][]) => Promise<{ count: number }>,
): Promise<number> => {
  const rows = await find();
  return rows.length ? (await remove(rows.map((row) => row.id))).count : 0;
};

const purgeSheetsWithoutAccount = async (now: Date): Promise<number> => {
  const before = ago(now, RETENTION_DAYS.sheetWithoutAccount);
  const sheets = await prisma.athlete.findMany({
    where: {
      userId: null,
      updatedAt: { lt: before },
      logs: { none: { updatedAt: { gte: before } } },
    },
    take: BATCH,
    select: { id: true },
  });
  if (sheets.length === 0) return 0;
  const ids = sheets.map((sheet) => sheet.id);
  await prisma.$transaction(async (tx) => {
    await deleteAthleteAssignments(tx, ids);
    await tx.athlete.deleteMany({ where: { id: { in: ids } } });
  });
  return ids.length;
};

// Deux temps : un préavis réellement envoyé, puis la suppression si le compte n'a pas repris vie entre-temps.
const handleInactiveAccounts = async (now: Date): Promise<{ warned: number; deleted: number }> => {
  const inactiveBefore = ago(now, RETENTION_DAYS.inactiveAccount);
  const idle = {
    OR: [{ lastActiveAt: { lt: inactiveBefore } }, { lastActiveAt: null, createdAt: { lt: inactiveBefore } }],
  };
  const toDelete = await prisma.profile.findMany({
    where: { ...idle, inactivityNoticeAt: { lte: ago(now, RETENTION_DAYS.inactivityNotice) } },
    take: 100,
    select: { id: true },
  });
  let deleted = 0;
  for (const profile of toDelete) {
    await deleteAccount(profile.id)
      .then(() => {
        deleted += 1;
      })
      .catch(() => log.error("retention_account_delete_failed"));
  }
  const toWarn = await prisma.profile.findMany({
    where: { ...idle, inactivityNoticeAt: null },
    take: 100,
    select: { id: true, user: { select: { email: true } } },
  });
  let warned = 0;
  for (const profile of toWarn) {
    try {
      await sendEmail({
        to: profile.user.email,
        subject: m.email.inactivity.subject,
        idempotencyKey: `inactivity/${profile.id}`,
        react: createElement(InactivityNoticeEmail, {
          days: RETENTION_DAYS.inactivityNotice,
          url: `${env().NEXT_PUBLIC_APP_URL}/connexion`,
        }),
      });
      await prisma.profile.update({ where: { id: profile.id }, data: { inactivityNoticeAt: now } });
      warned += 1;
    } catch {
      log.warn("retention_notice_failed");
    }
  }
  return { warned, deleted };
};

export const runRetention = async (now: Date = new Date()) => {
  const auditLogs = await purgeBatch(
    () =>
      prisma.auditLog.findMany({
        where: { at: { lt: ago(now, RETENTION_DAYS.auditLog) } },
        take: BATCH,
        select: { id: true },
      }),
    (ids) => prisma.auditLog.deleteMany({ where: { id: { in: ids } } }),
  );
  const notifications = await purgeBatch(
    () =>
      prisma.notification.findMany({
        where: { createdAt: { lt: ago(now, RETENTION_DAYS.notification) } },
        take: BATCH,
        select: { id: true },
      }),
    (ids) => prisma.notification.deleteMany({ where: { id: { in: ids } } }),
  );
  const { count: invitations } = await prisma.invitation.updateMany({
    where: {
      expiresAt: { lt: ago(now, RETENTION_DAYS.invitationContact) },
      OR: [{ email: { not: null } }, { phone: { not: null } }],
    },
    data: { email: null, phone: null },
  });
  const expiredBefore = ago(now, RETENTION_DAYS.expiredAuth);
  const { count: verifications } = await prisma.verification.deleteMany({
    where: { expiresAt: { lt: expiredBefore } },
  });
  const { count: sessions } = await prisma.session.deleteMany({ where: { expiresAt: { lt: expiredBefore } } });
  const { count: rateLimits } = await prisma.rateLimit.deleteMany({
    where: { lastRequest: { lt: BigInt(ago(now, RETENTION_DAYS.rateLimit).getTime()) } },
  });
  const { count: reports } = await prisma.contentReport.deleteMany({
    where: { resolvedAt: { lt: ago(now, RETENTION_DAYS.resolvedReport) } },
  });
  const { count: billingEvents } = await prisma.billingEvent.deleteMany({
    where: { createdAt: { lt: ago(now, RETENTION_DAYS.billingEvent) } },
  });
  const { count: deletions } = await prisma.externalDeletion.deleteMany({
    where: { state: "done", completedAt: { lt: ago(now, RETENTION_DAYS.finishedDeletion) } },
  });
  const sheets = await purgeSheetsWithoutAccount(now);
  const accounts = await handleInactiveAccounts(now);
  const result = {
    auditLogs,
    notifications,
    invitations,
    verifications,
    sessions,
    rateLimits,
    reports,
    billingEvents,
    deletions,
    sheets,
    ...accounts,
  };
  // Des comptes, jamais de contenu.
  log.info("retention_done", { count: Object.values(result).reduce((sum, value) => sum + value, 0) });
  return result;
};
