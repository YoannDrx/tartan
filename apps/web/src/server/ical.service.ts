import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { addDays } from "@tartan/domain";
import { fromDbDate, todayIso, toDbDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireAthleteAccess } from "./access";

const signature = (athleteId: string): string =>
  createHmac("sha256", env().BETTER_AUTH_SECRET).update(`ical:${athleteId}`).digest("base64url");

// Abonnement d'agenda (§ 7.6) : lien secret et révocable seulement en changeant de fiche ; aucune donnée de santé.
export const icalLink = async (userId: string, organizationId: string): Promise<string> => {
  const access = await requireAthleteAccess(userId, organizationId);
  return `${env().NEXT_PUBLIC_APP_URL}/api/ical/${access.athleteId}/${signature(access.athleteId)}`;
};

const esc = (text: string): string => text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export const icalFeed = async (athleteId: string, token: string, now: Date = new Date()): Promise<string> => {
  const a = Buffer.from(signature(athleteId));
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw notFound();
  const groups = await prisma.groupMember.findMany({ where: { athleteId }, select: { groupId: true } });
  const sessions = await prisma.scheduledSession.findMany({
    where: {
      publishedAt: { not: null },
      date: { gte: toDbDate(addDays(todayIso(now), -30)) },
      assignments: {
        some: {
          OR: [
            { targetType: "athlete", targetId: athleteId },
            { targetType: "group", targetId: { in: groups.map((g) => g.groupId) } },
          ],
        },
      },
    },
    select: { id: true, title: true, date: true, startTime: true, location: true, updatedAt: true },
  });
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const events = sessions.flatMap((s) => {
    const date = fromDbDate(s.date).replaceAll("-", "");
    const start = s.startTime ? `DTSTART;TZID=Europe/Paris:${date}T${s.startTime.replace(":", "")}00` : `DTSTART;VALUE=DATE:${date}`;
    return [
      "BEGIN:VEVENT",
      `UID:${createHash("sha256").update(s.id).digest("hex").slice(0, 24)}@tartan.coach`,
      `DTSTAMP:${stamp(s.updatedAt)}`,
      start,
      `SUMMARY:${esc(s.title)}`,
      ...(s.location ? [`LOCATION:${esc(s.location)}`] : []),
      "END:VEVENT",
    ];
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tartan//FR", "X-WR-CALNAME:Tartan", ...events, "END:VCALENDAR"].join("\r\n");
};
