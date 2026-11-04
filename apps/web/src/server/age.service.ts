import { ageStatus, type AgeStatus } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { fromDbDate, fromDbDateOrNull, todayIso, toDbDate } from "@/lib/dates";
import { AppError, invalid } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

// V1 réservée aux majeurs. Le parcours parental reste dans le code, dormant : absent = désactivé.
export const parentalFlowEnabled = (): boolean => process.env.PARENTAL_FLOW_ENABLED === "true";

export const ageRequired = () => new AppError(403, "age_required", m.age.required);
export const ageRestricted = () => new AppError(403, "age_restricted", m.age.restricted);

// L'âge se juge sur le jour de Paris : le jour des 18 ans, l'accès est ouvert dès minuit.
const statusOf = (birthDate: string | null, now: Date): AgeStatus =>
  ageStatus(birthDate, new Date(`${todayIso(now)}T12:00:00.000Z`));

export const ageStatusOfDate = (birthDate: Date | null | undefined, now: Date = new Date()): AgeStatus =>
  statusOf(fromDbDateOrNull(birthDate), now);

// La déclaration est journalisée sans la date ni aucune donnée d'identité.
const logMinorDeclared = (actorId: string | null): Promise<unknown> =>
  prisma.auditLog.create({ data: { actorId, action: "minor_declared", entity: "profile" } });

// Une date déclarée n'est pas une vérification d'identité : aucun texte ne doit le laisser croire.
export const assertAdultDate = async (
  iso: string | null | undefined,
  options: { actorId?: string | null; missing?: string; restricted?: AppError; now?: Date } = {},
): Promise<void> => {
  if (parentalFlowEnabled()) return;
  if (!iso) throw invalid(options.missing ?? m.invite.birthRequired);
  if (statusOf(iso, options.now ?? new Date()) !== "adult") {
    await logMinorDeclared(options.actorId ?? null);
    throw options.restricted ?? ageRestricted();
  }
};

// Toute lecture passe par requireOrgMember : la règle couvre le web, l'API et le mobile.
export const assertMemberAge = (birthDate: Date | null | undefined, now: Date = new Date()): void => {
  if (parentalFlowEnabled()) return;
  const status = ageStatusOfDate(birthDate, now);
  if (status === "unknown") throw ageRequired();
  if (status === "minor") throw ageRestricted();
};

export const ageStatusOfUser = async (userId: string, now: Date = new Date()): Promise<AgeStatus> => {
  if (parentalFlowEnabled()) return "adult";
  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { birthDate: true } });
  return ageStatusOfDate(profile?.birthDate, now);
};

// Compte sans date : première écriture seulement. Les fiches du compte sans date la reçoivent aussi.
export const confirmBirthDate = async (userId: string, iso: string, now: Date = new Date()): Promise<void> => {
  const [profile, sheets] = await Promise.all([
    prisma.profile.findUnique({ where: { id: userId }, select: { birthDate: true } }),
    prisma.athlete.findMany({ where: { userId }, select: { birthDate: true } }),
  ]);
  if (profile?.birthDate) throw new AppError(409, "age_already_set", m.age.alreadySet);
  // Une fiche préparée mineure ne se contourne pas par une autre saisie.
  const minorSheet = sheets.find((sheet) => ageStatusOfDate(sheet.birthDate, now) === "minor");
  const birthDate = minorSheet?.birthDate ? fromDbDate(minorSheet.birthDate) : iso;
  const value = toDbDate(birthDate);
  await prisma.$transaction([
    prisma.profile.upsert({
      where: { id: userId },
      create: { id: userId, birthDate: value },
      update: { birthDate: value },
    }),
    prisma.athlete.updateMany({ where: { userId, birthDate: null }, data: { birthDate: value } }),
  ]);
  await assertAdultDate(birthDate, { actorId: userId, now });
};
