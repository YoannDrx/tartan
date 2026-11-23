import {
  createPersonalSpaceInput,
  type CreatePersonalSpaceInput,
  type PersonalSpaceResponse,
  type SignupOptions,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { fromDbDateOrNull } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertAdultDate, confirmBirthDate } from "./age.service";
import { ensurePlans } from "./billing.service";
import { recordJoinConsents } from "./consent.service";
import { startOnboarding } from "./onboarding.service";
import { createStarterTemplates, starterExercises } from "./org.service";
import { platformSettings } from "./platform-settings.service";

// L'espace personnel d'un athlète qui s'entraîne seul (décision du 23 novembre 2026, docs/plans/athlete-autonome.md).
// Sur le modèle de l'espace d'un coach (bibliothèque, modèles, premiers pas) et de la démonstration (un espace à
// part, un seul par compte) : son titulaire en est l'unique membre, athlète de sa propre fiche, et y planifie pour
// lui seul (`personalScopeOf`, `packages/domain/src/permissions.ts`). Aucune invitation n'y fait entrer quelqu'un,
// aucun e-mail de coach n'en part, aucune facture ni plafond d'espace ne s'y applique (`COACH_SPACES`).

// Ce que l'aiguillage peut proposer à un compte sans espace, lu aussi par l'app native, sans session.
export const signupOptions = async (): Promise<SignupOptions> => {
  const settings = await platformSettings();
  return { coach: settings.signupMode === "public", athlete: settings.athleteSignupMode === "public" };
};

export const canCreatePersonalSpace = async (): Promise<boolean> => (await signupOptions()).athlete;

export const findPersonalSpace = (userId: string) =>
  prisma.organization.findUnique({ where: { personalOwnerId: userId }, select: { id: true } });

export const createPersonalSpace = async (
  userId: string,
  raw: CreatePersonalSpaceInput,
): Promise<PersonalSpaceResponse> => {
  const input = createPersonalSpaceInput.parse(raw);
  // Un seul espace personnel par compte : le redemander y ramène.
  const existing = await prisma.organization.findUnique({
    where: { personalOwnerId: userId },
    select: { id: true, athletes: { where: { userId }, select: { id: true } } },
  });
  if (existing?.athletes[0]) return { organizationId: existing.id, athleteId: existing.athletes[0].id };
  if (!(await canCreatePersonalSpace())) throw new AppError(403, "signup_closed", w.welcome.athleteClosed);
  await enforceRateLimit(`personal-space:${userId}`, 5, 3600);
  // Mêmes règles d'âge que l'espace d'un coach : la date déjà enregistrée prime, adultes seulement.
  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { birthDate: true } });
  const knownBirthDate = fromDbDateOrNull(profile?.birthDate);
  if (!knownBirthDate && input.birthDate) await confirmBirthDate(userId, input.birthDate);
  else await assertAdultDate(knownBirthDate, { actorId: userId });
  const birthDate = (await prisma.profile.findUnique({ where: { id: userId }, select: { birthDate: true } }))
    ?.birthDate;
  await ensurePlans();
  const created = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${userId}::uuid FOR UPDATE`;
    const named = await tx.profile.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
    // Le nom saisi devient celui du compte quand il n'en a pas : c'est ici qu'il se présente.
    if (!named?.firstName?.trim() || !named?.lastName?.trim()) {
      await tx.profile.upsert({
        where: { id: userId },
        create: { id: userId, firstName: input.firstName, lastName: input.lastName },
        update: { firstName: input.firstName, lastName: input.lastName },
      });
      await tx.user.update({ where: { id: userId }, data: { name: `${input.firstName} ${input.lastName}` } });
    }
    const org = await tx.organization.create({
      data: {
        name: m.personalSpace.name,
        type: "independent",
        kind: "personal",
        personalOwnerId: userId,
        ownerId: userId,
        plan: "personal",
        disciplines: input.disciplines,
        trainingObjectives: input.trainingObjectives,
        members: { create: { userId, role: "athlete", status: "active" } },
        exercises: { create: starterExercises(userId) },
      },
    });
    const athlete = await tx.athlete.create({
      data: {
        organizationId: org.id,
        userId,
        firstName: input.firstName,
        lastName: input.lastName,
        birthDate: birthDate ?? null,
        disciplines: input.disciplines,
      },
    });
    // Conditions acceptées et accords facultatifs, écrits avec l'espace : si l'un échoue, rien n'est créé.
    await recordJoinConsents(tx, {
      userId,
      organizationId: org.id,
      athleteId: athlete.id,
      health: input.consents.health,
      video: input.consents.video,
    });
    // Premiers pas d'athlète autonome : carte, page des premiers pas, conseils par e-mail.
    await startOnboarding(tx, org.id, userId);
    // Les séances de départ, modifiables : il ne part pas d'une page blanche.
    await createStarterTemplates(tx, org.id, userId);
    return { organizationId: org.id, athleteId: athlete.id };
  });
  log.info("personal_space_created", { organizationId: created.organizationId });
  return created;
};
