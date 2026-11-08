import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { exerciseHistoryQuery, type DetailedSetInput, type SessionLogInput } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { getAthleteExerciseHistory, listAthleteHistoryExercises } from "@/server/exercise-history.service";
import { logSession } from "@/server/athlete-view.service";
import { publishRow, saveScheduledSession } from "@/server/session.service";
import { selectStrengthReference } from "@/server/strength.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";

const range = { from: "2030-06-01", to: "2030-06-30" };
const set = (extra: Partial<DetailedSetInput> = {}): DetailedSetInput => ({
  itemRef: "b0-i0",
  setIndex: 0,
  reps: 4,
  loadKg: 40,
  done: true,
  setKind: "work",
  loadKind: "external",
  repetitionScope: "total",
  sideCount: 1,
  ...extra,
});
const setup = async () => {
  const org = await makeOrg("Historique");
  await prisma.organization.update({ where: { id: org.organizationId }, data: { progressionEnabled: true } });
  const athlete = await addAthlete(org.organizationId, org.groupId, "Athlète");
  const exercise = await prisma.exercise.findFirstOrThrow({
    where: { organizationId: org.organizationId, name: "Squat arrière" },
  });
  const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
    date: "2030-06-12",
    startTime: null,
    location: null,
    publishAt: null,
    assignments: [{ targetType: "group", targetId: org.groupId }],
    overrides: [],
    draft: {
      title: "Force",
      type: "strength",
      durationMin: 45,
      coachNote: "NOTE_PRIVÉE_TEST",
      blocks: [
        {
          name: "Travail",
          variant: "club",
          items: [{ exerciseId: exercise.id, prescription: { sets: 3, reps: 4, load: { type: "kg", value: 100 } } }],
        },
      ],
    },
  });
  await publishRow(session.id, org.owner.userId, new Date("2030-06-01T10:00:00Z"), { silent: true });
  const log = (data: Partial<SessionLogInput> = {}) =>
    logSession(athlete.userId, org.organizationId, session.id, {
      clientId: randomUUID(),
      status: "partial",
      variantDone: "club",
      expectedVersion: 0,
      expectedSessionVersion: 2,
      detailedSets: [
        set(),
        set({ setIndex: 1 }),
        set({ setIndex: 2, done: false }),
        set({ setIndex: 3, setKind: "warmup", loadKg: 20 }),
      ],
      ...data,
    });
  const read = (actor = athlete.userId) =>
    getAthleteExerciseHistory(actor, org.organizationId, athlete.athleteId, exercise.id, range);
  return { ...org, athlete, exercise, session, log, read };
};

it("sépare prescription, réalisé partiel, échauffement et données manquantes sans exposer les retours privés", async () => {
  const a = await setup();
  await a.log({ comment: "COMMENTAIRE_SANTE_TEST", rpe: 8, pain: { bodyArea: "knee", side: "left", intensity: 3 } });
  const result = await a.read();
  expect(result.coverage).toMatchObject({ totalSessions: 1, detailedSessions: 1, unusableSets: 0, truncated: false });
  expect(result.sessions[0]).toMatchObject({
    recordedBy: a.athlete.userId,
    version: 1,
    status: "partial",
    volumes: { tonnageKg: 320, completedWorkSets: 2, tonnageKnownSets: 2, distanceM: null },
    items: [
      {
        name: "Squat arrière",
        resolvedLoadKg: 100,
        strengthLoadKind: "external_total",
        prescription: { sets: 3, reps: 4 },
        sets: [{ loadKg: 40 }, { loadKg: 40 }, { done: false }, { setKind: "warmup" }],
      },
    ],
  });
  expect(JSON.stringify(result)).not.toContain("NOTE_PRIVÉE_TEST");
  expect(JSON.stringify(result)).not.toContain("COMMENTAIRE_SANTE_TEST");
  expect(result.sessions[0]).not.toHaveProperty("rpe");
  expect(result.sessions[0]).not.toHaveProperty("pain");
  expect(await listAthleteHistoryExercises(a.athlete.userId, a.organizationId, a.athlete.athleteId)).toMatchObject([
    { id: a.exercise.id, hasRealizedSets: true },
  ]);
  expect((await a.read(a.owner.userId)).sessions).toEqual(result.sessions);
});

it("un maximum récent, un renommage ou archivage ne réécrit pas la réalisation", async () => {
  const a = await setup();
  await a.log();
  await selectStrengthReference(a.owner.userId, a.organizationId, a.athlete.athleteId, a.exercise.id, {
    source: "working",
    valueKg: 200,
  });
  await prisma.exercise.update({ where: { id: a.exercise.id }, data: { name: "Nouveau nom", deletedAt: new Date() } });
  const result = await a.read();
  expect(result.exercise).toMatchObject({ name: "Nouveau nom", archived: true });
  expect(result.reference).toMatchObject({ valueKg: 200, kind: "working" });
  expect(result.sessions[0]).toMatchObject({
    volumes: { tonnageKg: 320 },
    items: [{ name: "Squat arrière", resolvedLoadKg: 100 }],
  });
  expect(await listAthleteHistoryExercises(a.athlete.userId, a.organizationId, a.athlete.athleteId)).toMatchObject([
    { archived: true },
  ]);
});

it("une correction et une suppression de séries se reflètent immédiatement, un ancien rejeu ne les rétablit pas", async () => {
  const a = await setup();
  const clientId = randomUUID();
  await a.log({ clientId });
  await a.log({ expectedVersion: 1, detailedSets: [set({ loadKg: 30 })] });
  expect((await a.read()).sessions[0]).toMatchObject({ version: 2, volumes: { tonnageKg: 120 } });
  await a.log({ clientId });
  expect((await a.read()).sessions[0]?.volumes.tonnageKg).toBe(120);
  await a.log({ expectedVersion: 2, detailedSets: [] });
  expect((await a.read()).sessions).toEqual([]);
  expect(await listAthleteHistoryExercises(a.athlete.userId, a.organizationId, a.athlete.athleteId)).toEqual([]);
});

it("ne transforme pas les anciennes cases ou une identité perdue en séries chiffrées", async () => {
  const a = await setup();
  await a.log();
  await prisma.setLog.updateMany({ where: { log: { scheduledSessionId: a.session.id } }, data: { loadKind: null } });
  const result = await a.read();
  expect(result.sessions[0]?.volumes.tonnageKg).toBeNull();
  expect(result.coverage).toMatchObject({ totalSessions: 1, detailedSessions: 0, unusableSets: 4 });
  await prisma.setLog.updateMany({ where: { log: { scheduledSessionId: a.session.id } }, data: { exerciseId: null } });
  expect((await a.read()).sessions).toEqual([]);
});

it("vérifie rôle, groupe, espace, révocation, flag et bornes de période", async () => {
  const a = await setup();
  await a.log();
  const other = await makeOrg("Autre");
  const otherAthlete = await addAthlete(a.organizationId, a.groupId, "Autre athlète");
  const coach = await addStaff(a.organizationId, "Coach hors groupe", "coach");
  for (const actor of [other.owner.userId, otherAthlete.userId, coach.userId]) {
    await expect(a.read(actor)).rejects.toMatchObject({ status: 403 });
    await expect(listAthleteHistoryExercises(actor, a.organizationId, a.athlete.athleteId)).rejects.toMatchObject({
      status: 403,
    });
  }
  await prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId: a.organizationId, userId: a.athlete.userId } },
    data: { status: "suspended" },
  });
  await expect(a.read()).rejects.toMatchObject({ status: 403 });
  await prisma.organization.update({ where: { id: a.organizationId }, data: { progressionEnabled: false } });
  await expect(a.read(a.owner.userId)).rejects.toMatchObject({ code: "progression_disabled" });
  for (const query of [
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2030-07-01", to: "2030-06-01" },
    { from: "2028-01-01", to: "2030-06-01" },
  ])
    expect(exerciseHistoryQuery.safeParse(query).success).toBe(false);
});

it("signale une période tronquée au lieu de présenter les dernières séances comme un historique exhaustif", async () => {
  const a = await setup();
  const original = await a.log();
  const log = await prisma.sessionLog.findUniqueOrThrow({ where: { id: original.id }, include: { sets: true } });
  const ids = Array.from({ length: 201 }, () => ({ session: randomUUID(), log: randomUUID() }));
  await prisma.scheduledSession.createMany({
    data: ids.map((ids) => ({
      id: ids.session,
      organizationId: a.organizationId,
      createdBy: a.owner.userId,
      date: new Date("2030-06-13"),
      title: "Charge historique",
      type: "strength",
      publishedAt: new Date("2030-06-01"),
    })),
  });
  await prisma.sessionLog.createMany({
    data: ids.map((ids) => ({
      id: ids.log,
      athleteId: a.athlete.athleteId,
      scheduledSessionId: ids.session,
      status: "done",
      version: 1,
      prescriptionSnapshot: log.prescriptionSnapshot!,
    })),
  });
  await prisma.setLog.createMany({
    data: ids.map((ids) => ({
      ...set(),
      sessionLogId: ids.log,
      exerciseId: a.exercise.id,
    })),
  });
  const result = await a.read();
  expect(result.coverage).toMatchObject({
    totalSessions: 202,
    returnedSessions: 200,
    limitSessions: 200,
    truncated: true,
  });
  expect(result.sessions.every((session) => session.date === "2030-06-13")).toBe(true);
  const empty = await getAthleteExerciseHistory(
    a.athlete.userId,
    a.organizationId,
    a.athlete.athleteId,
    a.exercise.id,
    { from: "2030-07-01", to: "2030-07-31" },
  );
  expect(empty.coverage).toMatchObject({ totalSessions: 0, returnedSessions: 0, truncated: false });
});
