import type { CellStatus } from "@tartan/contracts";
import { addDays, completionPct, cellStatusOf, startOfWeek } from "@tartan/domain";
import { formatDayMonth } from "@tartan/i18n";
import { createElement } from "react";
import { WeeklyDigestEmail } from "@email/digest";
import { fromDbDate, hourInParis, todayIso, toDbDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { unsubscribePageUrl, unsubscribeUrl } from "./email-preferences.service";
import { audienceAthleteIds } from "./session.service";

// Récapitulatif du dimanche soir au coach (§ 13.1). Pas de donnée de santé dans un e-mail.
export const sendWeeklyDigests = async (now: Date = new Date()): Promise<number> => {
  const today = todayIso(now);
  const isSunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
  // À partir de 18 h : un passage manqué se rattrape au suivant, l'audit évite tout doublon.
  if (!isSunday || hourInParis(now) < 18) return 0;
  const monday = startOfWeek(today);
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      owner: { select: { id: true, email: true, profile: { select: { emailDigest: true } } } },
    },
  });
  let sent = 0;
  let failed = 0;
  for (const org of orgs) {
    if (org.owner.profile?.emailDigest === false) continue;
    try {
      const already = await prisma.auditLog.findFirst({
        where: { organizationId: org.id, action: "weekly_digest_sent", entityId: monday },
      });
      if (already) continue;
      const sessions = await prisma.scheduledSession.findMany({
        where: {
          organizationId: org.id,
          publishedAt: { not: null },
          date: { gte: toDbDate(monday), lte: toDbDate(today) },
        },
        select: { id: true, date: true, logs: { select: { athleteId: true, status: true } } },
      });
      if (sessions.length === 0) continue;
      const statuses: CellStatus[] = [];
      const withAccount = new Set(
        (
          await prisma.athlete.findMany({
            where: { organizationId: org.id, userId: { not: null } },
            select: { id: true },
          })
        ).map((athlete) => athlete.id),
      );
      for (const session of sessions) {
        for (const athleteId of await audienceAthleteIds(session.id)) {
          statuses.push(
            cellStatusOf(
              session.logs.find((l) => l.athleteId === athleteId),
              fromDbDate(session.date),
              now,
              withAccount.has(athleteId),
            ),
          );
        }
      }
      await sendEmail({
        to: org.owner.email,
        subject: `Ta semaine sur Tartan : ${org.name}`,
        idempotencyKey: `digest/${org.id}/${monday}`,
        unsubscribeUrl: unsubscribeUrl(org.owner.id, "digest"),
        react: createElement(WeeklyDigestEmail, {
          organization: org.name,
          weekLabel: formatDayMonth(monday),
          sessions: sessions.length,
          completionPct: completionPct(statuses),
          url: `${env().NEXT_PUBLIC_APP_URL}/suivi?semaine=${addDays(monday, 0)}&espace=${org.id}`,
          unsubscribe: unsubscribePageUrl(org.owner.id, "digest"),
        }),
      });
      await prisma.auditLog.create({
        data: { organizationId: org.id, action: "weekly_digest_sent", entity: "organization", entityId: monday },
      });
      sent += 1;
    } catch {
      // Un espace en échec n'empêche pas les autres de recevoir le leur.
      failed += 1;
      log.error("weekly_digest_failed", { organizationId: org.id });
    }
  }
  log.info("weekly_digest", { count: sent });
  if (failed) throw new Error("cron_digest_failed");
  return sent;
};
