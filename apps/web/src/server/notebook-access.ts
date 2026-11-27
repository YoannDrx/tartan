import { prisma } from "@/lib/prisma";
import { ageStatusOfUser } from "./age.service";
import { platformSettings } from "./platform-settings.service";

// Athlète actif d'un espace de coach réel (ni carnet, ni démonstration). Son carnet ne dépend pas des inscriptions
// d'athlètes, et il n'en reçoit pas les e-mails d'accueil de l'athlète autonome.
export const isClubAthlete = async (userId: string): Promise<boolean> =>
  Boolean(
    await prisma.organizationMember.findFirst({
      where: { userId, role: "athlete", status: "active", organization: { kind: { not: "personal" }, isDemo: false } },
      select: { userId: true },
    }),
  );

// Le carnet s'ouvre aux inscriptions d'athlètes ouvertes, ou à l'athlète invité par un coach (décision du
// 27 novembre 2026) : offert par Tartan, sur l'offre `personal`, sans toucher au quota du coach. Jamais à un mineur.
// À part du service du carnet pour que `/me` le lise sans cycle d'imports.
export const canOpenNotebook = async (userId: string): Promise<boolean> => {
  if ((await ageStatusOfUser(userId)) === "minor") return false;
  if ((await platformSettings()).athleteSignupMode === "public") return true;
  return isClubAthlete(userId);
};
