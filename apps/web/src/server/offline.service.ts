import { addDays, isStaff } from "@tartan/domain";
import { todayIso } from "@/lib/dates";
import { requireOrgMember } from "./access";
import { getAthleteCalendar } from "./athlete-view.service";
import { listCalendar } from "./session.service";
import { prisma } from "@/lib/prisma";

export const OFFLINE_DAYS = 7;

// Ce que le téléphone garde pour le stade (§ 10.4) : la journée et les séances des 7 prochains jours.
export const offlineUrls = async (userId: string, organizationId: string, now: Date = new Date()) => {
  const access = await requireOrgMember(userId, organizationId);
  const from = todayIso(now);
  const to = addDays(from, OFFLINE_DAYS);
  if (isStaff(access.role)) {
    const { sessions } = await listCalendar(userId, organizationId, { from, to: addDays(from, 1) });
    return {
      urls: [
        "/accueil",
        "/suivi",
        "/calendrier",
        "/videos",
        ...sessions.filter((s) => s.publishedAt).map((s) => `/seances/${s.id}/suivi`),
      ],
    };
  }
  const { sessions } = await getAthleteCalendar(userId, organizationId, { from, to }, now);
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { progressionEnabled: true },
  });
  return {
    urls: [
      "/accueil",
      "/aujourdhui",
      "/calendrier",
      "/annonces",
      ...sessions.flatMap((s) => [
        `/seance/${s.id}`,
        `/seance/${s.id}/mode`,
        ...(org.progressionEnabled ? [`/seance/${s.id}/series`] : []),
      ]),
    ],
  };
};
