import { randomUUID } from "node:crypto";
import {
  DEMO_ANNOUNCEMENTS,
  DEMO_ATHLETES,
  DEMO_COACH_NOTE,
  DEMO_COMMENTS,
  DEMO_CONSENT_VERSION,
  DEMO_GROUPS,
  DEMO_INJURY,
  DEMO_SESSION_NOTES,
  DEMO_SPACE_NAME,
  addDays,
  demoOutcome,
  demoPhases,
  demoSchedule,
  demoSpaceExpiry,
  demoSquatLoad,
  demoStrengthTests,
  demoTemplate,
  demoValidatedToday,
  isStaff,
  seededRandom,
  startOfWeek,
  type DemoSessionKind,
} from "@tartan/domain";
import type { SessionDraft } from "@tartan/contracts";
import { todayIso, toDbDate } from "@/lib/dates";
import { forbidden } from "@/lib/errors";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireOrgMember } from "./access";
import { ensurePlans } from "./billing.service";
import { createStarterTemplates, starterExercises } from "./org.service";
import { publishRow, saveScheduledSession } from "./session.service";

// L'espace de démonstration d'un coach : un espace à part, dont il est le seul membre, rempli d'athlètes fictifs
// sans compte. Aucun e-mail, aucune notification, aucune facture n'en part (`demo-space-guard.ts`). Un seul par
// coach : l'ouvrir à nouveau le remet à zéro. Il s'efface au bout de 14 jours, ou quand le coach le supprime.

export type DemoSpaceView = { organizationId: string; expiresAt: string };

const view = (org: { id: string; demoExpiresAt: Date | null }): DemoSpaceView => ({
  organizationId: org.id,
  expiresAt: (org.demoExpiresAt ?? new Date()).toISOString(),
});

// Les modèles citent les exercices, qui sont protégés : ils partent d'abord, puis l'espace et tout ce qu'il porte.
const removeSpace = async (organizationId: string): Promise<void> => {
  await prisma.$transaction([
    prisma.sessionTemplate.deleteMany({ where: { organizationId } }),
    prisma.organization.deleteMany({ where: { id: organizationId, isDemo: true } }),
  ]);
};

// Le coach doit l'être dans un espace où il est membre : un athlète n'ouvre pas de démonstration.
const requireCoach = async (userId: string, organizationId: string) => {
  const access = await requireOrgMember(userId, organizationId);
  if (!isStaff(access.role)) throw forbidden();
  return access;
};

export const getDemoSpace = async (userId: string, fromOrganizationId: string): Promise<DemoSpaceView | null> => {
  await requireCoach(userId, fromOrganizationId);
  const org = await prisma.organization.findUnique({
    where: { demoOwnerId: userId },
    select: { id: true, demoExpiresAt: true, isDemo: true },
  });
  return org?.isDemo ? view(org) : null;
};

export const openDemoSpace = async (
  userId: string,
  fromOrganizationId: string,
  now: Date = new Date(),
): Promise<DemoSpaceView> => {
  await requireCoach(userId, fromOrganizationId);
  await enforceRateLimit(`demo-space:${userId}`, 10, 3600);
  await ensurePlans();
  const previous = await prisma.organization.findUnique({ where: { demoOwnerId: userId }, select: { id: true } });
  if (previous) await removeSpace(previous.id);

  const created = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: DEMO_SPACE_NAME,
        type: "independent",
        disciplines: [...new Set(DEMO_ATHLETES.flatMap((athlete) => athlete.disciplines))],
        ownerId: userId,
        // Offre sans plafond ni prix : rien à facturer, rien à limiter, et aucun abonnement écrit.
        plan: "pilot",
        isDemo: true,
        demoOwnerId: userId,
        demoExpiresAt: demoSpaceExpiry(now),
        aiPlannerEnabled: false,
        overdueReminders: false,
        members: { create: { userId, role: "owner", status: "active" } },
        exercises: { create: starterExercises(userId) },
      },
      select: { id: true, demoExpiresAt: true },
    });
    const groups = [];
    for (const group of DEMO_GROUPS) {
      groups.push(
        await tx.group.create({
          data: {
            organizationId: org.id,
            name: group.name,
            goal: group.goal,
            coaches: { create: { userId, role: "lead" } },
          },
          select: { id: true },
        }),
      );
    }
    await createStarterTemplates(tx, org.id, userId);
    return { org, groupIds: groups.map((group) => group.id) };
  });

  try {
    await fillDemoSpace(userId, created.org.id, created.groupIds, now);
  } catch (error) {
    // Une démonstration à moitié remplie ne sert à rien : elle repart, et le coach peut réessayer.
    await removeSpace(created.org.id).catch(() => log.error("demo_space_cleanup_failed"));
    throw error;
  }
  return view(created.org);
};

// Le coach supprime sa démonstration, depuis elle ou depuis son espace.
export const deleteDemoSpace = async (userId: string, fromOrganizationId: string): Promise<boolean> => {
  await requireCoach(userId, fromOrganizationId);
  const org = await prisma.organization.findUnique({
    where: { demoOwnerId: userId },
    select: { id: true, isDemo: true },
  });
  if (!org?.isDemo) return false;
  await removeSpace(org.id);
  return true;
};

// Tâche horaire : les démonstrations ouvertes depuis 14 jours s'effacent.
export const purgeExpiredDemoSpaces = async (now: Date = new Date()): Promise<number> => {
  const expired = await prisma.organization.findMany({
    where: { isDemo: true, demoExpiresAt: { lte: now } },
    select: { id: true },
  });
  let purged = 0;
  let failed = 0;
  for (const org of expired) {
    try {
      await removeSpace(org.id);
      purged += 1;
    } catch {
      failed += 1;
      log.error("demo_space_purge_failed", { entityId: org.id });
    }
  }
  if (failed) throw new Error("demo_space_purge_failed");
  return purged;
};

const fillDemoSpace = async (coachId: string, organizationId: string, groupIds: string[], now: Date) => {
  const today = todayIso(now);
  const random = seededRandom(Number(today.replaceAll("-", "")));
  const library = await prisma.exercise.findMany({ where: { organizationId }, select: { id: true, name: true } });
  const exerciseId = (name: string) => {
    const found = library.find((row) => row.name === name);
    if (!found) throw new Error(`demo_exercise_missing:${name}`);
    return found.id;
  };
  const draftOf = (kind: DemoSessionKind): SessionDraft => {
    const template = demoTemplate(kind);
    return {
      title: template.title,
      type: template.type,
      durationMin: template.durationMin,
      coachNote: DEMO_SESSION_NOTES[kind],
      blocks: template.blocks.map((block) => ({
        name: block.name,
        variant: "club" as const,
        items: block.items.map((item) => ({ exerciseId: exerciseId(item.exercise), prescription: item.prescription })),
      })),
    };
  };

  // Les athlètes : des fiches sans compte, avec des accords fictifs marqués comme tels.
  const athletes: { id: string; profile: (typeof DEMO_ATHLETES)[number] }[] = [];
  for (const profile of DEMO_ATHLETES) {
    const athlete = await prisma.athlete.create({
      data: {
        organizationId,
        userId: null,
        firstName: profile.firstName,
        lastName: profile.lastName,
        disciplines: profile.disciplines,
        level: profile.level,
        goals: profile.goal,
        groups: {
          create: { groupId: groupIds[profile.group]!, createdAt: new Date(`${addDays(today, -60)}T10:00:00Z`) },
        },
        athleteConsents: {
          create: (["video", "health"] as const).map((kind) => {
            const granted = kind === "video" || profile.health;
            return {
              kind,
              version: DEMO_CONSENT_VERSION,
              grantedAt: granted ? now : null,
              revokedAt: granted ? null : now,
            };
          }),
        },
      },
      select: { id: true },
    });
    athletes.push({ id: athlete.id, profile });
  }

  // Les séances, publiées sans notification, puis les validations des séances passées et d'une partie du jour.
  const publishedAt = new Date(`${addDays(startOfWeek(today), -35)}T10:00:00Z`);
  const squatRef = "b1-i0";
  const squatId = exerciseId("Squat arrière");
  for (const slot of demoSchedule(today)) {
    const draft = draftOf(slot.kind);
    const session = await saveScheduledSession(coachId, organizationId, {
      date: slot.date,
      startTime: "18:30",
      location: slot.kind === "strength" ? "Salle de force" : "Stade",
      draft,
      assignments: [{ targetType: "group", targetId: groupIds[slot.group]! }],
      overrides: [],
      publishAt: null,
    });
    await publishRow(session.id, coachId, publishedAt, { silent: true });
    if (!slot.past && !slot.today) continue;
    const members = athletes.filter((athlete) => athlete.profile.group === slot.group);
    const logs = members.flatMap(({ id, profile }, index) => {
      // Aujourd'hui, un athlète sur deux a déjà validé : le suivi du jour se remplit, le reste est à venir.
      if (slot.today && !demoValidatedToday(index)) return [];
      const athlete = slot.today ? { ...profile, assiduity: 1 } : profile;
      const outcome = demoOutcome({ kind: slot.kind, durationMin: draft.durationMin ?? 60, athlete, random });
      return [{ athleteId: id, profile, outcome }];
    });
    if (logs.length === 0) continue;
    const written = await prisma.sessionLog.createManyAndReturn({
      data: logs.map(({ athleteId, outcome }) => ({
        scheduledSessionId: session.id,
        athleteId,
        clientId: randomUUID(),
        status: outcome.status,
        variantDone: outcome.variant,
        rpe: outcome.rpe,
        durationMin: outcome.durationMin,
        comment: outcome.comment ? DEMO_COMMENTS[outcome.comment] : null,
        completedAt: outcome.status === "missed" ? null : new Date(`${slot.date}T19:45:00Z`),
      })),
      select: { id: true, athleteId: true, status: true },
    });
    await prisma.attendance.createMany({
      data: logs.map(({ athleteId, outcome }) => ({
        scheduledSessionId: session.id,
        athleteId,
        status: outcome.status === "missed" ? ("absent" as const) : ("present" as const),
        source: "coach" as const,
      })),
    });
    // Le détail des séries au squat, pour les séances de force faites : la progression a des chiffres.
    if (slot.kind !== "strength") continue;
    const weeksAgo = Math.max(0, Math.round((Date.parse(today) - Date.parse(slot.date)) / (7 * 86_400_000)));
    await prisma.setLog.createMany({
      data: written
        .filter((row) => row.status === "done")
        .flatMap((row) => {
          const profile = athletes.find((athlete) => athlete.id === row.athleteId)!.profile;
          return Array.from({ length: 4 }, (_, setIndex) => ({
            sessionLogId: row.id,
            itemRef: squatRef,
            exerciseId: squatId,
            setIndex,
            reps: 5,
            loadKg: demoSquatLoad(profile, weeksAgo),
            done: true,
          }));
        }),
    });
  }

  // Phases du premier groupe, tests de force, blessure suivie, note privée, annonces.
  for (const phase of demoPhases(today)) {
    await prisma.trainingPhase.create({
      data: {
        id: randomUUID(),
        organizationId,
        creationFingerprint: randomUUID(),
        groupId: groupIds[0]!,
        name: phase.name,
        kind: phase.kind,
        startDate: toDbDate(phase.startDate),
        endDate: toDbDate(phase.endDate),
        objective: phase.objective,
        publishedAt,
        createdBy: coachId,
      },
    });
  }
  await prisma.strengthTest.createMany({
    data: athletes.flatMap(({ id, profile }) =>
      demoStrengthTests(profile, today).map((test) => ({
        organizationId,
        athleteId: id,
        exerciseId: squatId,
        exerciseKey: "back_squat",
        kind: "one_rm" as const,
        value: test.value,
        date: toDbDate(test.date),
      })),
    ),
  });
  const injured = athletes[DEMO_INJURY.athlete];
  if (injured?.profile.health) {
    await prisma.injury.create({
      data: {
        organizationId,
        athleteId: injured.id,
        bodyArea: DEMO_INJURY.bodyArea,
        side: DEMO_INJURY.side,
        startDate: toDbDate(addDays(today, -DEMO_INJURY.daysAgo)),
        status: DEMO_INJURY.status,
        restrictions: DEMO_INJURY.restrictions,
      },
    });
  }
  const noted = athletes[DEMO_COACH_NOTE.athlete];
  if (noted) {
    await prisma.coachNote.create({
      data: { organizationId, athleteId: noted.id, authorId: coachId, body: DEMO_COACH_NOTE.body },
    });
  }
  await prisma.announcement.createMany({
    data: DEMO_ANNOUNCEMENTS.map((announcement) => ({
      organizationId,
      groupId: groupIds[announcement.group]!,
      authorId: coachId,
      pinned: announcement.pinned,
      body: announcement.body,
    })),
  });
};
