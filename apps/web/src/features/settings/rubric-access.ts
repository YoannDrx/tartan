import { redirect } from "next/navigation";
import { requireSpace } from "@/features/shell/space";
import { env } from "@/lib/env";
import { requireOrgMember } from "@/server/access";
import { ensureReferralCode } from "@/server/org.service";
import { referralStats } from "@/server/referral.service";
import { SETTINGS_ROOT, canOpenRubric, type SettingsRubric } from "./sections";

// L'entrée de chaque rubrique : l'espace courant, le rôle relu par le service, et le droit d'ouvrir la rubrique.
// Une rubrique fermée à ce rôle ramène au sommaire ; les services revérifient ensuite chaque lecture.
export const requireRubric = async (rubric: SettingsRubric) => {
  const context = await requireSpace();
  const access = await requireOrgMember(context.actor.userId, context.organizationId);
  if (!canOpenRubric(access.role, rubric)) redirect(SETTINGS_ROOT);
  return { ...context, access };
};

// Le lien de parrainage et ses compteurs, créés à la première lecture.
export const loadReferral = async (userId: string) => {
  await ensureReferralCode(userId);
  const stats = await referralStats(userId);
  return stats ? { ...stats, link: `${env().NEXT_PUBLIC_APP_URL}/r/${stats.code}` } : null;
};
