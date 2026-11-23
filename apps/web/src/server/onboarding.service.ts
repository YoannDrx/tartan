import type { OnboardingPatch, OnboardingResponse } from "@tartan/contracts";
import {
  athleteExtrasVisible,
  coachCelebrationDue,
  coachChecklist,
  coachGuideVisible,
  coachOptionalSteps,
  coachProgress,
  coachTourDue,
  isCoachOptionalStep,
  personalCelebrationDue,
  personalChecklist,
  personalGuideVisible,
  personalProgress,
  type PersonalOnboardingFacts,
  type CoachOnboardingFacts,
  type CoachOptionalStepKey,
  type OnboardingMemory,
} from "@tartan/domain";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, visibleAthleteIds } from "./access";

// Les premiers pas d'un membre dans un espace. Les étapes obligatoires sont déduites des faits réels
// (`@tartan/domain`) ; la table `onboarding_states` ne garde que ce que les faits ne disent pas.

type Db = Prisma.TransactionClient;

// La ligne naît avec le membre, dans la transaction qui le crée : création de l'espace ou invitation acceptée.
export const startOnboarding = async (db: Db, organizationId: string, userId: string): Promise<void> => {
  await db.onboardingState.createMany({ data: [{ organizationId, userId }], skipDuplicates: true });
};

const memoryOf = (
  row: {
    guided: boolean;
    tourSeenAt: Date | null;
    welcomeSeenAt: Date | null;
    dismissedAt: Date | null;
    celebratedAt: Date | null;
    skipped: string[];
    seenScreens: string[];
  } | null,
): OnboardingMemory | null => (row?.guided ? row : null);

const readRow = (organizationId: string, userId: string) =>
  prisma.onboardingState.findUnique({ where: { organizationId_userId: { organizationId, userId } } });

// Les faits des premiers pas. `athleteIds` : les athlètes que le membre voit ; absent, tout l'espace.
// `userId` : le coach dont on lit le profil et les appareils.
export const readCoachFacts = async (
  organizationId: string,
  userId: string,
  athleteIds?: string[],
): Promise<CoachOnboardingFacts> => {
  const athleteScope = athleteIds ? { athleteId: { in: athleteIds } } : { athlete: { organizationId } };
  const [
    profile,
    organization,
    invitations,
    athletes,
    sessions,
    publishedSessions,
    validations,
    videos,
    phases,
    devices,
    installations,
  ] = await Promise.all([
    prisma.profile.findUnique({ where: { id: userId }, select: { avatarUrl: true, avatarPreset: true } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { availableEquipment: true } }),
    prisma.invitation.count({ where: { organizationId, role: "athlete" } }),
    athleteIds ? Promise.resolve(athleteIds.length) : prisma.athlete.count({ where: { organizationId } }),
    prisma.scheduledSession.count({ where: { organizationId } }),
    prisma.scheduledSession.count({ where: { organizationId, publishedAt: { not: null } } }),
    prisma.sessionLog.count({ where: { ...athleteScope, status: { in: ["done", "partial"] } } }),
    prisma.video.count({ where: { organizationId } }),
    prisma.trainingPhase.count({ where: { organizationId, deletedAt: null } }),
    prisma.device.count({ where: { userId } }),
    prisma.clientInstallation.count({ where: { userId } }),
  ]);
  return {
    // Une photo envoyée ou un avatar choisi dans la galerie.
    profileComplete: Boolean(profile?.avatarUrl || profile?.avatarPreset),
    invitations,
    athletes,
    sessions,
    publishedSessions,
    validations,
    equipment: organization?.availableEquipment.length ?? 0,
    videos,
    phases,
    installed: devices + installations > 0,
  };
};

// Les faits des premiers pas de l'athlète autonome, dans son espace personnel : lus par la carte et par les e-mails.
export const readPersonalFacts = async (
  organizationId: string,
  userId: string,
  athleteId: string,
): Promise<PersonalOnboardingFacts> => {
  const [sessions, validations, tests, performances, devices, installations] = await Promise.all([
    prisma.scheduledSession.count({ where: { organizationId } }),
    prisma.sessionLog.count({ where: { athleteId, status: { in: ["done", "partial"] } } }),
    prisma.strengthTest.count({ where: { athleteId } }),
    prisma.performance.count({ where: { athleteId } }),
    prisma.device.count({ where: { userId } }),
    prisma.clientInstallation.count({ where: { userId } }),
  ]);
  return { sessions, validations, measures: tests + performances, installed: devices + installations > 0 };
};

const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

// Ce qu'un écran a besoin de savoir, sans les faits : tour dû, repères vus. Lu par le gabarit à chaque page.
export const getOnboardingMemory = async (userId: string, organizationId: string) => {
  const access = await requireOrgMember(userId, organizationId);
  const memory = memoryOf(await readRow(organizationId, userId));
  return {
    staff: access.role !== "athlete",
    guided: memory !== null,
    tourDue: access.role !== "athlete" && coachTourDue(memory),
    seenScreens: memory ? [...memory.seenScreens] : [],
  };
};

export const getOnboarding = async (userId: string, organizationId: string): Promise<OnboardingResponse> => {
  const access = await requireOrgMember(userId, organizationId);
  const row = await readRow(organizationId, userId);
  const memory = memoryOf(row);
  const base = {
    guided: memory !== null,
    staff: access.role !== "athlete",
    tourSeenAt: iso(row?.tourSeenAt ?? null),
    welcomeSeenAt: iso(row?.welcomeSeenAt ?? null),
    dismissedAt: iso(row?.dismissedAt ?? null),
    celebratedAt: iso(row?.celebratedAt ?? null),
    skipped: (row?.skipped ?? []).filter(isCoachOptionalStep),
    seenScreens: row?.seenScreens ?? [],
  };
  if (access.personal && access.athleteId) {
    const facts = await readPersonalFacts(organizationId, userId, access.athleteId);
    return {
      ...base,
      steps: [],
      optionalSteps: [],
      progress: { done: 0, total: 0 },
      guideVisible: false,
      tourDue: false,
      celebrationDue: false,
      extrasVisible: false,
      personal: {
        steps: personalChecklist(facts),
        progress: personalProgress(facts),
        guideVisible: personalGuideVisible(facts, memory),
        celebrationDue: personalCelebrationDue(facts, memory),
      },
    };
  }
  if (access.role === "athlete") {
    const validations = access.athleteId
      ? await prisma.sessionLog.count({
          where: { athleteId: access.athleteId, status: { in: ["done", "partial"] } },
        })
      : 0;
    return {
      ...base,
      steps: [],
      optionalSteps: [],
      progress: { done: 0, total: 0 },
      guideVisible: false,
      tourDue: false,
      celebrationDue: false,
      extrasVisible: athleteExtrasVisible({ validations, memory }),
    };
  }
  const facts = await readCoachFacts(organizationId, userId, await visibleAthleteIds(access));
  return {
    ...base,
    steps: coachChecklist(facts),
    optionalSteps: coachOptionalSteps(facts, row?.skipped ?? []),
    progress: coachProgress(facts),
    guideVisible: coachGuideVisible(facts, memory),
    tourDue: coachTourDue(memory),
    celebrationDue: coachCelebrationDue(facts, memory),
    extrasVisible: false,
  };
};

// Ce que la carte « Pour démarrer » propose en plus des étapes : le premier groupe à inviter, deux modèles de départ.
export const getGuideContext = async (userId: string, organizationId: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  const [group, templates] = await Promise.all([
    prisma.group.findFirst({
      where: {
        organizationId,
        ...(access.role === "owner" ? {} : { coaches: { some: { userId } } }),
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.sessionTemplate.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true },
      take: 2,
    }),
  ]);
  return { group, templates };
};

// La page des premiers pas : l'état de chaque grande fonction dans cet espace, en nombres réels.
export const getFeatureOverview = async (userId: string, organizationId: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  const athleteIds = await visibleAthleteIds(access);
  const [publishedSessions, exercises, videos, phases, announcements] = await Promise.all([
    prisma.scheduledSession.count({ where: { organizationId, publishedAt: { not: null } } }),
    prisma.exercise.count({ where: { organizationId, deletedAt: null } }),
    prisma.video.count({ where: { organizationId } }),
    prisma.trainingPhase.count({ where: { organizationId, deletedAt: null } }),
    prisma.announcement.count({ where: { organizationId } }),
  ]);
  return { athletes: athleteIds.length, publishedSessions, exercises, videos, phases, announcements };
};

const SEEN_SCREENS_MAX = 40;

// Chaque écriture ne touche que ce membre, dans cet espace. Un membre d'avant ce suivi qui referme quelque chose
// reçoit une ligne `guided = false` : son geste est gardé, sans qu'il devienne un nouveau venu.
export const updateOnboarding = async (
  userId: string,
  organizationId: string,
  patch: OnboardingPatch,
): Promise<OnboardingResponse> => {
  await requireOrgMember(userId, organizationId);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const where = { organizationId_userId: { organizationId, userId } };
    const row =
      (await tx.onboardingState.findUnique({ where })) ??
      (await tx.onboardingState.upsert({ where, create: { organizationId, userId, guided: false }, update: {} }));
    const skipped = new Set(row.skipped);
    if (patch.skip) skipped.add(patch.skip);
    if (patch.unskip) skipped.delete(patch.unskip);
    const seen = new Set(row.seenScreens);
    if (patch.seenScreen && seen.size < SEEN_SCREENS_MAX) seen.add(patch.seenScreen);
    await tx.onboardingState.update({
      where,
      data: {
        tourSeenAt: patch.tourSeen ? (row.tourSeenAt ?? now) : undefined,
        welcomeSeenAt: patch.welcomeSeen ? (row.welcomeSeenAt ?? now) : undefined,
        dismissedAt: patch.dismissed === undefined ? undefined : patch.dismissed ? (row.dismissedAt ?? now) : null,
        celebratedAt: patch.celebrated ? (row.celebratedAt ?? now) : undefined,
        skipped: [...skipped].filter((key): key is CoachOptionalStepKey => isCoachOptionalStep(key)),
        seenScreens: [...seen],
      },
    });
  });
  return getOnboarding(userId, organizationId);
};
