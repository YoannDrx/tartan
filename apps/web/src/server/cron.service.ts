import { processBillingCommands } from "./billing-command.service";
import { expirePlannerOperations } from "./ai/usage.service";
import { purgePlannerProposals } from "./ai/proposal.service";
import { purgePlannerTranscriptions } from "./ai/transcription.service";
import { addDays, isOverdue, MISSED_STREAK_THRESHOLD } from "@tartan/domain";
import { fromDbDate, todayIso, toDbDate, hourInParis } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { processReferrals, purgeExpiredVideos } from "./billing.service";
import { sendWeeklyDigests } from "./digest.service";
import { firstNameOf } from "./me.service";
import { dispatchPending, notify, notifyPublications } from "./notify.service";
import { coachesOfAthlete } from "./org.service";
import { runReleaseJobs } from "./releases.service";
import { activeAudienceIds, audienceAthleteIds, publishRow, type Publication } from "./session.service";
import { runCronJobs } from "./cron-runner";
import { purgeRevokedConsentVideos } from "./consent.service";
import { processExternalDeletions, reconcileExternalAssets } from "./external-deletion.service";
import { sendHeartbeat } from "./heartbeat";
import { runRetention } from "./retention.service";
import { reconcileStripeSubscriptions } from "./stripe-subscriptions.service";

// Une seule alerte, au moment où la série atteint le seuil (§ 13.2) : pas de rappel à chaque nouvelle séance.
const alertMissedStreak = async (organizationId: string, athleteIds: string[]): Promise<void> => {
  for (const athleteId of athleteIds) {
    const recent = await prisma.sessionLog.findMany({
      where: { athleteId },
      orderBy: { session: { date: "desc" } },
      take: MISSED_STREAK_THRESHOLD + 1,
      select: { status: true },
    });
    const streak = recent.findIndex((r) => r.status !== "missed");
    if ((streak === -1 ? recent.length : streak) !== MISSED_STREAK_THRESHOLD) continue;
    const athlete = await prisma.athlete.findUniqueOrThrow({ where: { id: athleteId }, select: { firstName: true } });
    await notify(await coachesOfAthlete(organizationId, athleteId), "missed_streak", {
      athlete: athlete.firstName,
      organizationId,
      link: `/athletes/${athleteId}`,
    });
  }
};

// Passe en « manquée » les séances non validées 24 h après la date prévue, avec une relance douce.
export const closeOverdueSessions = async (now: Date = new Date()): Promise<number> => {
  const sessions = await prisma.scheduledSession.findMany({
    where: {
      publishedAt: { not: null },
      date: { gte: toDbDate(addDays(todayIso(now), -14)), lt: toDbDate(todayIso(now)) },
    },
    orderBy: { date: "asc" },
    select: { id: true, date: true, organizationId: true, organization: { select: { overdueReminders: true } } },
  });
  let closed = 0;
  let failed = 0;
  for (const session of sessions) {
    try {
      const date = fromDbDate(session.date);
      if (!isOverdue(date, now)) continue;
      const audience = await audienceAthleteIds(session.id);
      const logged = await prisma.sessionLog.findMany({
        where: { scheduledSessionId: session.id, athleteId: { in: audience } },
        select: { athleteId: true },
      });
      // Une fiche sans compte ne valide jamais elle-même : aucune séance « manquée » en son nom.
      const withAccount = await prisma.athlete.findMany({
        where: { id: { in: audience }, userId: { not: null } },
        select: { id: true },
      });
      const missing = withAccount.map((a) => a.id).filter((id) => !logged.some((l) => l.athleteId === id));
      if (missing.length === 0) continue;
      await prisma.sessionLog.createMany({
        data: missing.map((athleteId) => ({
          scheduledSessionId: session.id,
          athleteId,
          status: "missed" as const,
          reminderSentAt: now,
        })),
        skipDuplicates: true,
      });
      closed += missing.length;
      await alertMissedStreak(session.organizationId, missing);
      if (!session.organization.overdueReminders) continue;
      const users = await prisma.athlete.findMany({
        where: { id: { in: missing }, userId: { not: null } },
        select: { userId: true },
      });
      await notify(
        users.map((u) => u.userId as string),
        "session_reminder",
        { organizationId: session.organizationId, sessionId: session.id, link: `/seance/${session.id}` },
        now,
      );
    } catch {
      failed++;
      log.error("cron_session_close_failed", { entityId: session.id });
    }
  }
  if (failed) throw new Error("cron_sessions_close_failed");
  log.info("cron_close_overdue", { count: closed });
  return closed;
};

export const publishScheduledSessions = async (now: Date = new Date()): Promise<number> => {
  const due = await prisma.scheduledSession.findMany({
    where: { publishedAt: null, publishAt: { lte: now } },
    select: {
      id: true,
      createdBy: true,
      organizationId: true,
      date: true,
      organization: { select: { ownerId: true } },
    },
  });
  // Un brouillon programmé sans destinataire ne doit pas bloquer les autres.
  const lots = new Map<string, { createdBy: string; organizationId: string; publications: Publication[] }>();
  let published = 0;
  for (const session of due) {
    try {
      const publications = await publishRow(session.id, session.createdBy, now, { silent: true });
      const key = `${session.organizationId}:${session.createdBy}`;
      const lot = lots.get(key) ?? {
        createdBy: session.createdBy,
        organizationId: session.organizationId,
        publications: [],
      };
      lot.publications.push(...publications);
      lots.set(key, lot);
      published += 1;
    } catch (error) {
      log.warn("scheduled_publish_skipped", { entityId: session.id });
      // Auteur révoqué : le brouillon attend une décision du propriétaire, qui en est prévenu une seule fois.
      if (error instanceof AppError && error.status === 403) {
        const stopped = await prisma.scheduledSession.updateMany({
          where: { id: session.id, publishedAt: null, publishAt: { not: null } },
          data: { publishAt: null },
        });
        if (stopped.count === 1)
          await notify([session.organization.ownerId], "scheduled_publication_blocked", {
            date: fromDbDate(session.date),
            link: `/seances/${session.id}`,
          });
      }
    }
  }
  for (const lot of lots.values()) {
    await notifyPublications(lot.publications, {
      coach: await firstNameOf(lot.createdBy),
      organizationId: lot.organizationId,
    });
  }
  return published;
};

// « Seras-tu au club demain ? » la veille d'une séance, une seule fois par séance.
export const sendEveQuestions = async (now: Date = new Date()): Promise<number> => {
  const tomorrow = addDays(todayIso(now), 1);
  const sessions = await prisma.scheduledSession.findMany({
    where: { publishedAt: { not: null }, date: toDbDate(tomorrow) },
    select: { id: true, organizationId: true },
  });
  let sent = 0;
  let failed = 0;
  for (const session of sessions) {
    try {
      const audience = await activeAudienceIds(session.id);
      const athletes = await prisma.athlete.findMany({
        where: {
          id: { in: audience },
          userId: { not: null },
          attendance: { none: { scheduledSessionId: session.id } },
        },
        select: { userId: true },
      });
      const users = athletes.map((a) => a.userId as string);
      const already = await prisma.notification.findMany({
        where: { userId: { in: users }, type: "session_eve", payload: { path: ["sessionId"], equals: session.id } },
        select: { userId: true },
      });
      const remaining = users.filter((u) => !already.some((n) => n.userId === u));
      await notify(
        remaining,
        "session_eve",
        { organizationId: session.organizationId, sessionId: session.id, link: `/seance/${session.id}` },
        now,
      );
      sent += remaining.length;
    } catch {
      failed++;
      log.error("cron_session_eve_failed", { entityId: session.id });
    }
  }
  if (failed) throw new Error("cron_sessions_eve_failed");
  return sent;
};

export const runHourlyJobs = async (now: Date = new Date()) => {
  const result = await runCronJobs({
    published: () => publishScheduledSessions(now),
    closed: () => closeOverdueSessions(now),
    eve: () => sendEveQuestions(now),
    dispatched: () => dispatchPending(now),
    releases: () => runReleaseJobs(now),
    billingCommands: () => processBillingCommands(now),
    aiReservations: () => expirePlannerOperations(now),
    aiProposals: () => purgePlannerProposals(now),
    aiTranscriptions: () => purgePlannerTranscriptions(now),
    billing: () => reconcileStripeSubscriptions(now),
    referrals: () => processReferrals(now),
    purged: () => purgeExpiredVideos(now),
    digests: () => sendWeeklyDigests(now),
    // D'abord les lignes : leur suppression met les fichiers en file, traitée juste après.
    revokedVideos: () => purgeRevokedConsentVideos(now),
    // Une fois par jour, avant le rapprochement : un compte supprimé part dans la même file.
    retention: async () => (hourInParis(now) === 3 ? runRetention(now) : null),
    externalDeletions: () => processExternalDeletions(now),
    // Une fois par jour, au creux de la nuit.
    reconciled: async () => (hourInParis(now) === 4 ? reconcileExternalAssets(now) : null),
  });
  await sendHeartbeat("hourly", result.errors);
  return result;
};
