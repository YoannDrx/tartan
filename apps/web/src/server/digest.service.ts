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
import { audienceAthleteIds } from "./session.service";

// Récapitulatif du dimanche soir au coach (§ 13.1). Pas de donnée de santé dans un e-mail.
export const sendWeeklyDigests = async (now: Date = new Date()): Promise<number> => {
  const today = todayIso(now);
  const isSunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
  if (!isSunday || hourInParis(now) !== 18) return 0;
  const monday = startOfWeek(today);
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, owner: { select: { id: true, email: true } } },
  });
  let sent = 0;
  for (const org of orgs) {
    const already = await prisma.auditLog.findFirst({ where: { organizationId: org.id, action: "weekly_digest_sent", entityId: monday } });
    if (already) continue;
    const sessions = await prisma.scheduledSession.findMany({
      where: { organizationId: org.id, publishedAt: { not: null }, date: { gte: toDbDate(monday), lte: toDbDate(today) } },
      select: { id: true, date: true, logs: { select: { athleteId: true, status: true } } },
    });
    if (sessions.length === 0) continue;
    const statuses: CellStatus[] = [];
    for (const session of sessions) {
      for (const athleteId of await audienceAthleteIds(session.id)) {
        statuses.push(cellStatusOf(session.logs.find((l) => l.athleteId === athleteId), fromDbDate(session.date), now));
      }
    }
    await sendEmail({
      to: org.owner.email,
      subject: `Ta semaine sur Tartan : ${org.name}`,
      react: createElement(WeeklyDigestEmail, {
        organization: org.name,
        weekLabel: formatDayMonth(monday),
        sessions: sessions.length,
        completionPct: completionPct(statuses),
        url: `${env().NEXT_PUBLIC_APP_URL}/suivi?semaine=${addDays(monday, 0)}`,
      }),
    });
    await prisma.auditLog.create({ data: { organizationId: org.id, action: "weekly_digest_sent", entity: "organization", entityId: monday } });
    sent += 1;
  }
  log.info("weekly_digest", { count: sent });
  return sent;
};
