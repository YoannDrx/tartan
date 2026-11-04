import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { sessionDraft } from "@tartan/contracts";
import { addDays } from "@tartan/domain";
import { fromDbDate, todayIso, toDbDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { athleteAssignedWhere } from "./session-audience.service";
import { requireAthleteAccess } from "./access";

// La version 0 garde l'ancienne forme : les agendas déjà abonnés continuent de fonctionner.
const signature = (athleteId: string, version: number): string =>
  createHmac("sha256", env().BETTER_AUTH_SECRET)
    .update(version === 0 ? `ical:${athleteId}` : `ical:${athleteId}:${version}`)
    .digest("base64url");

const icalVersionOf = async (athleteId: string): Promise<number> => {
  const athlete = await prisma.athlete.findUnique({ where: { id: athleteId }, select: { icalVersion: true } });
  if (!athlete) throw notFound();
  return athlete.icalVersion;
};

// Abonnement d'agenda (§ 7.6) : lien secret et révocable ; aucune donnée de santé.
export const icalLink = async (userId: string, organizationId: string): Promise<string> => {
  const access = await requireAthleteAccess(userId, organizationId);
  const version = await icalVersionOf(access.athleteId);
  return `${env().NEXT_PUBLIC_APP_URL}/api/ical/${access.athleteId}/${signature(access.athleteId, version)}`;
};

export const revokeIcalLink = async (userId: string, organizationId: string): Promise<void> => {
  const access = await requireAthleteAccess(userId, organizationId);
  await prisma.athlete.update({ where: { id: access.athleteId }, data: { icalVersion: { increment: 1 } } });
};

const esc = (text: string): string =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Sans fin d'événement, un agenda affiche une séance sans durée. Une séance ne déborde jamais sur le lendemain.
const endTime = (startTime: string, durationMin: number): string => {
  const [hours = 0, minutes = 0] = startTime.split(":").map(Number);
  const end = Math.min(hours * 60 + minutes + durationMin, 23 * 60 + 59);
  return `${String(Math.floor(end / 60)).padStart(2, "0")}${String(end % 60).padStart(2, "0")}`;
};

export const icalFeed = async (athleteId: string, token: string, now: Date = new Date()): Promise<string> => {
  const a = Buffer.from(signature(athleteId, await icalVersionOf(athleteId)));
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw notFound();
  const sessions = await prisma.scheduledSession.findMany({
    where: {
      ...(await athleteAssignedWhere(athleteId)),
      date: { gte: toDbDate(addDays(todayIso(now), -30)) },
    },
    select: { id: true, title: true, date: true, startTime: true, location: true, draft: true, updatedAt: true },
  });
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const events = sessions.flatMap((s) => {
    const date = fromDbDate(s.date).replaceAll("-", "");
    const start = s.startTime
      ? `DTSTART;TZID=Europe/Paris:${date}T${s.startTime.replace(":", "")}00`
      : `DTSTART;VALUE=DATE:${date}`;
    return [
      "BEGIN:VEVENT",
      `UID:${createHash("sha256").update(s.id).digest("hex").slice(0, 24)}@tartan.coach`,
      `DTSTAMP:${stamp(s.updatedAt)}`,
      start,
      ...(s.startTime
        ? [
            `DTEND;TZID=Europe/Paris:${date}T${endTime(
              s.startTime,
              sessionDraft.safeParse(s.draft).data?.durationMin ?? 60,
            )}00`,
          ]
        : []),
      `SUMMARY:${esc(s.title)}`,
      ...(s.location ? [`LOCATION:${esc(s.location)}`] : []),
      "END:VEVENT",
    ];
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tartan//FR",
    "X-WR-CALNAME:Tartan",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
};
