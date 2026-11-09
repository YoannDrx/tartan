import { m } from "@tartan/i18n";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const hasAiConsent = async (userId: string): Promise<boolean> => {
  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { aiConsentAt: true } });
  return Boolean(profile?.aiConsentAt);
};

// Rien ne part chez OpenAI sans l'accord explicite de la personne qui écrit ou dicte.
export const requireAiConsent = async (userId: string): Promise<void> => {
  if (!(await hasAiConsent(userId))) throw new AppError(409, "ai_consent_required", m.aiPlanner.consentRequired);
};
