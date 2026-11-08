import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import type { SaveScheduledSessionInput, SessionLogInput } from "@tartan/contracts";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { adminDisableAiEverywhere, adminOverview, adminSetSpaceFeatures } from "@/server/admin.service";
import { getAthleteSessionForCoach, logSession, logSessionForAthlete } from "@/server/athlete-view.service";
import { publishScheduledSessions } from "@/server/cron.service";
import { saveExercise } from "@/server/exercise.service";
import { duplicateWeek, getSessionForEdit, publishRow, saveScheduledSession } from "@/server/session.service";
import { coachLogSession, getSessionDetailForCoach } from "@/server/tracking.service";
import { addAthlete, addStaff, makeOrg, makeUser } from "./helpers";

afterEach(() => {
  env().ADMIN_EMAILS = "";
});

const setup = async (progressionEnabled = false) => {
  const org = await makeOrg("Fusion");
  if (progressionEnabled)
    await prisma.organization.update({ where: { id: org.organizationId }, data: { progressionEnabled } });
  const athlete = await addAthlete(org.organizationId, org.groupId, "Athlète");
  const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: org.organizationId } });
  const input = (date = "2030-06-12", groupId = org.groupId): SaveScheduledSessionInput => ({
    date,
    startTime: null,
    location: null,
    publishAt: null,
    assignments: [{ targetType: "group", targetId: groupId }],
    overrides: [],
    draft: {
      title: "Force",
      type: "strength",
      durationMin: 45,
      coachNote: null,
      blocks: [
        {
          name: "Travail",
          variant: "club",
          items: [{ exerciseId: exercise.id, prescription: { sets: 3, reps: 4 } }],
        },
      ],
    },
  });
  const published = async (date?: string, groupId?: string) => {
    const saved = await saveScheduledSession(org.owner.userId, org.organizationId, input(date, groupId));
    await publishRow(saved.id, org.owner.userId, new Date("2030-06-01T10:00:00Z"), { silent: true });
    return prisma.scheduledSession.findUniqueOrThrow({ where: { id: saved.id } });
  };
  return { ...org, athlete, exercise, input, published };
};

const quick = (session: { version: number }, data: Partial<SessionLogInput> = {}): SessionLogInput => ({
  clientId: randomUUID(),
  status: "done",
  variantDone: "club",
  writeScope: "status",
  expectedVersion: 0,
  expectedSessionVersion: session.version,
  sets: [],
  ...data,
});

const editedByCoach = async (a: Awaited<ReturnType<typeof setup>>, sessionId: string) => {
  const edit = await getSessionForEdit(a.owner.userId, a.organizationId, sessionId);
  await saveScheduledSession(a.owner.userId, a.organizationId, edit);
};

it("une validation simple aboutit même si le coach vient de modifier la séance", async () => {
  const a = await setup();
  const session = await a.published();
  await editedByCoach(a, session.id);
  const result = await logSession(a.athlete.userId, a.organizationId, session.id, quick(session));
  expect(result).toMatchObject({ version: 1 });
  expect(await prisma.sessionLog.count({ where: { scheduledSessionId: session.id, status: "done" } })).toBe(1);
});

it("une case cochée sur un exercice retiré n'empêche pas d'enregistrer la séance", async () => {
  const a = await setup();
  const session = await a.published();
  const stale = [{ itemRef: "exercice-retire", setIndex: 0, done: true }];
  await logSession(a.athlete.userId, a.organizationId, session.id, quick(session, { sets: stale }));
  expect(await prisma.setLog.count({ where: { log: { scheduledSessionId: session.id } } })).toBe(0);
  expect(await prisma.sessionLog.count({ where: { scheduledSessionId: session.id, status: "done" } })).toBe(1);
});

it("les séries détaillées restent refusées sur une prescription modifiée", async () => {
  const a = await setup(true);
  const session = await a.published();
  await editedByCoach(a, session.id);
  await expect(
    logSession(a.athlete.userId, a.organizationId, session.id, quick(session, { writeScope: "all", detailedSets: [] })),
  ).rejects.toMatchObject({ code: "session_version_conflict" });
});

it("une simple case cochée ne verrouille pas la convention de charge", async () => {
  const a = await setup();
  const session = await a.published();
  const snapshot = session.snapshot as { blocks: { items: { ref: string }[] }[] };
  const itemRef = snapshot.blocks[0]!.items[0]!.ref;
  await logSession(
    a.athlete.userId,
    a.organizationId,
    session.id,
    quick(session, { sets: [{ itemRef, setIndex: 0, done: true }] }),
  );
  expect(await prisma.setLog.count({ where: { exerciseId: a.exercise.id } })).toBe(1);
  await expect(
    saveExercise(a.owner.userId, a.organizationId, {
      id: a.exercise.id,
      name: a.exercise.name,
      category: a.exercise.category,
      strengthLoadKind: "added_weight",
    }),
  ).resolves.toBeTruthy();
});

it("la publication programmée d'un auteur révoqué s'arrête et prévient une seule fois le propriétaire", async () => {
  const a = await setup();
  const coach = await addStaff(a.organizationId, "Parti", "coach", [a.groupId]);
  const saved = await saveScheduledSession(coach.userId, a.organizationId, {
    ...a.input(),
    publishAt: "2026-06-10T09:00:00.000Z",
  });
  await prisma.organizationMember.delete({
    where: { organizationId_userId: { organizationId: a.organizationId, userId: coach.userId } },
  });
  const noon = new Date("2026-06-15T10:00:00.000Z");
  expect(await publishScheduledSessions(noon)).toBe(0);
  await publishScheduledSessions(noon);
  const row = await prisma.scheduledSession.findUniqueOrThrow({ where: { id: saved.id } });
  expect(row.publishedAt).toBeNull();
  expect(row.publishAt).toBeNull();
  const notices = await prisma.notification.findMany({
    where: { userId: a.owner.userId, type: "scheduled_publication_blocked" },
  });
  expect(notices).toHaveLength(1);
  expect(notices[0]?.payload).toMatchObject({ link: `/seances/${saved.id}` });
});

it("le staff ne peut ni inventer ni effacer le retour santé d'un athlète", async () => {
  const a = await setup(true);
  const session = await a.published();
  await logSession(a.athlete.userId, a.organizationId, session.id, {
    ...quick(session),
    writeScope: "all",
    rpe: 8,
  });
  const write = (data: Partial<SessionLogInput>) =>
    logSessionForAthlete(a.owner.userId, a.organizationId, session.id, a.athlete.athleteId, {
      clientId: randomUUID(),
      status: "done",
      variantDone: "club",
      expectedVersion: 1,
      expectedSessionVersion: session.version,
      ...data,
    });
  await expect(write({ writeScope: "feedback", rpe: null })).rejects.toBeTruthy();
  await expect(write({ writeScope: "status" })).rejects.toBeTruthy();
  expect((await prisma.sessionLog.findFirstOrThrow({ where: { scheduledSessionId: session.id } })).rpe).toBe(8);
  // Même forme qu'une relecture de conflit : les séries passent, le retour de l'athlète ne bouge pas.
  await write({ writeScope: "all", detailedSets: [], rpe: 2, comment: "Écrit par le coach" });
  expect((await prisma.sessionLog.findFirstOrThrow({ where: { scheduledSessionId: session.id } })).rpe).toBe(8);
});

it("consulter les séries d'un athlète journalise l'accès à ses données de santé", async () => {
  const a = await setup(true);
  const session = await a.published();
  await logSession(a.athlete.userId, a.organizationId, session.id, {
    ...quick(session),
    writeScope: "all",
    rpe: 7,
  });
  await getAthleteSessionForCoach(a.owner.userId, a.organizationId, session.id, a.athlete.athleteId);
  expect(
    await prisma.auditLog.count({
      where: { actorId: a.owner.userId, action: "health_read", entityId: a.athlete.athleteId },
    }),
  ).toBe(1);
});

it("la duplication d'une semaine ignore les séances hors périmètre du coach", async () => {
  const a = await setup();
  const other = await prisma.group.create({ data: { organizationId: a.organizationId, name: "Autre" } });
  const coach = await addStaff(a.organizationId, "Limité", "coach", [a.groupId]);
  await a.published("2030-06-10");
  await a.published("2030-06-11", other.id);
  expect(await duplicateWeek(coach.userId, a.organizationId, { fromWeek: "2030-06-10", toWeek: "2030-06-17" })).toEqual(
    {
      count: 1,
    },
  );
});

it("le détail d'une séance hors périmètre n'est pas lisible par un coach", async () => {
  const a = await setup();
  const other = await prisma.group.create({ data: { organizationId: a.organizationId, name: "Autre" } });
  const coach = await addStaff(a.organizationId, "Limité", "coach", [a.groupId]);
  const mine = await a.published("2030-06-10");
  const outside = await a.published("2030-06-11", other.id);
  await expect(getSessionDetailForCoach(coach.userId, a.organizationId, mine.id)).resolves.toMatchObject({
    id: mine.id,
  });
  await expect(getSessionDetailForCoach(coach.userId, a.organizationId, outside.id)).rejects.toMatchObject({
    status: 404,
  });
});

it("un adjoint ne valide pas pour un athlète sans compte sur la séance d'un autre coach", async () => {
  const a = await setup();
  const assistant = await addStaff(a.organizationId, "Adjoint", "assistant", [a.groupId]);
  const sheet = await prisma.athlete.create({
    data: {
      organizationId: a.organizationId,
      firstName: "Sans",
      lastName: "Compte",
      birthDate: new Date("2000-01-01T00:00:00Z"),
      groups: { create: { groupId: a.groupId } },
    },
  });
  const session = await a.published();
  await expect(coachLogSession(assistant.userId, a.organizationId, session.id, sheet.id, "done")).rejects.toMatchObject(
    { status: 403 },
  );
});

it("l'éditeur active les fonctions par espace, avec trace, et coupe l'IA partout d'un geste", async () => {
  const a = await setup();
  const b = await makeOrg("Autre");
  const intruder = await makeUser("Intrus");
  const actor = await makeUser("Support");
  env().ADMIN_EMAILS = actor.email;
  const flags = { progressionEnabled: true, phasesEnabled: true, aiPlannerEnabled: true };
  await expect(adminSetSpaceFeatures(intruder, { organizationId: a.organizationId, ...flags })).rejects.toMatchObject({
    status: 403,
  });
  await adminSetSpaceFeatures(actor, { organizationId: a.organizationId, ...flags });
  await adminSetSpaceFeatures(actor, { organizationId: b.organizationId, ...flags });
  expect(await prisma.organization.findUniqueOrThrow({ where: { id: a.organizationId } })).toMatchObject(flags);
  expect((await adminOverview(actor)).spaces.find((space) => space.id === a.organizationId)).toMatchObject(flags);
  expect(
    await prisma.auditLog.count({
      where: { actorId: actor.userId, entity: "organization", entityId: a.organizationId },
    }),
  ).toBe(1);
  await expect(adminDisableAiEverywhere(intruder)).rejects.toMatchObject({ status: 403 });
  await adminDisableAiEverywhere(actor);
  expect(
    await prisma.organization.count({
      where: { id: { in: [a.organizationId, b.organizationId] }, aiPlannerEnabled: true },
    }),
  ).toBe(0);
  expect(await prisma.organization.findUniqueOrThrow({ where: { id: a.organizationId } })).toMatchObject({
    progressionEnabled: true,
  });
});
