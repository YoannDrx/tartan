import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { type SessionLogInput, type SaveScheduledSessionInput } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { getAthleteSession, logSession } from "@/server/athlete-view.service";
import { publishRow, saveScheduledSession } from "@/server/session.service";
import { athleteWeeklyStats } from "@/server/stats.service";
import { addAthlete, makeOrg } from "./helpers";

const setup = async () => {
  const org = await makeOrg("Progression");
  await prisma.organization.update({ where: { id: org.organizationId }, data: { progressionEnabled: true } });
  const athlete = await addAthlete(org.organizationId, org.groupId, "Athlète");
  const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: org.organizationId } });
  const input: SaveScheduledSessionInput = {
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
      coachNote: null,
      blocks: [
        {
          name: "Travail",
          variant: "club",
          items: [
            {
              exerciseId: exercise.id,
              prescription: {
                sets: 3,
                reps: 4,
                load: { type: "pct_1rm", value: 80, test: "squat" },
              },
            },
          ],
        },
      ],
    },
  };
  const session = await saveScheduledSession(org.owner.userId, org.organizationId, input);
  await publishRow(session.id, org.owner.userId, new Date("2030-06-01T10:00:00Z"), { silent: true });
  const log = (data: Partial<SessionLogInput> = {}) =>
    logSession(athlete.userId, org.organizationId, session.id, {
      clientId: randomUUID(),
      status: "done",
      variantDone: "club",
      expectedVersion: 0,
      expectedSessionVersion: 1,
      detailedSets: [
        {
          itemRef: "b0-i0",
          setIndex: 0,
          reps: 4,
          loadKg: 40,
          done: true,
          setKind: "work",
          loadKind: "external",
          repetitionScope: "total",
          sideCount: 1,
        },
      ],
      ...data,
    });
  return { ...org, athlete, exercise, session, input, log };
};

it("enregistre le réalisé, sa version et son auteur sans supposer la prescription effectuée", async () => {
  const a = await setup();
  const result = await a.log();
  expect(result).toMatchObject({ version: 1, replayed: false });
  const saved = await prisma.sessionLog.findUniqueOrThrow({ where: { id: result.id }, include: { sets: true } });
  expect(saved.recordedBy).toBe(a.athlete.userId);
  expect(saved.sets).toHaveLength(1);
  expect(saved.sets[0]?.exerciseId).toBe(a.exercise.id);
  const detail = await getAthleteSession(a.athlete.userId, a.organizationId, a.session.id);
  expect(detail.log?.detailedSets?.[0]).toMatchObject({ reps: 4, loadKg: 40 });
});

it("désactive les nouvelles écritures sans couper la validation simple", async () => {
  const a = await setup();
  await prisma.organization.update({ where: { id: a.organizationId }, data: { progressionEnabled: false } });
  await expect(a.log()).rejects.toMatchObject({ code: "progression_disabled" });
  await expect(a.log({ detailedSets: undefined })).resolves.toMatchObject({ replayed: false });
});

it("un seul de deux appareils peut écrire la même version", async () => {
  const a = await setup();
  const results = await Promise.allSettled([a.log(), a.log()]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
  expect(rejected.reason).toMatchObject({ code: "log_version_conflict", status: 409 });
});

it("le rejeu A après la correction B ne remet pas A en place", async () => {
  const a = await setup();
  const clientId = randomUUID();
  await a.log({ clientId });
  await a.log({ expectedVersion: 1, detailedSets: [] });
  expect(await a.log({ clientId })).toMatchObject({ replayed: true, version: 2 });
  const row = await prisma.sessionLog.findFirstOrThrow({
    where: { scheduledSessionId: a.session.id },
    include: { sets: true },
  });
  expect(row.sets).toHaveLength(0);
  expect(row.version).toBe(2);
});

it("une ancienne application ne peut pas supprimer des séries détaillées", async () => {
  const a = await setup();
  await a.log();
  await expect(
    a.log({ detailedSets: undefined, expectedVersion: undefined, expectedSessionVersion: undefined, sets: [] }),
  ).rejects.toMatchObject({ code: "legacy_log_conflict" });
  expect(await prisma.setLog.count({ where: { log: { scheduledSessionId: a.session.id } } })).toBe(1);
});

it("les anciennes validations simples conservent leurs cases si aucun détail n'est envoyé", async () => {
  const a = await setup();
  await a.log({
    detailedSets: undefined,
    expectedVersion: undefined,
    expectedSessionVersion: undefined,
    sets: [{ itemRef: "b0-i0", setIndex: 0, done: true }],
  });
  await a.log({ detailedSets: undefined, expectedVersion: undefined, expectedSessionVersion: undefined, sets: [] });
  expect(await prisma.setLog.count({ where: { log: { scheduledSessionId: a.session.id } } })).toBe(1);
});

it("signale une prescription modifiée et refuse les références d'un autre exercice", async () => {
  const a = await setup();
  await saveScheduledSession(a.owner.userId, a.organizationId, { ...a.input, id: a.session.id });
  await expect(a.log()).rejects.toMatchObject({ code: "session_version_conflict" });
  await expect(
    a.log({
      expectedSessionVersion: 2,
      detailedSets: [
        {
          itemRef: "inconnu",
          setIndex: 0,
          done: true,
          setKind: "work",
          loadKind: "external",
          repetitionScope: "total",
          sideCount: 1,
        },
      ],
    }),
  ).rejects.toMatchObject({ status: 400 });
});

it("un nouveau maximum et un exercice remplacé ne réécrivent pas la réalisation passée", async () => {
  const a = await setup();
  await prisma.strengthTest.create({
    data: {
      organizationId: a.organizationId,
      athleteId: a.athlete.athleteId,
      exerciseKey: "squat",
      value: 50,
      kind: "one_rm",
      date: new Date("2029-01-01"),
    },
  });
  await a.log();
  await prisma.strengthTest.create({
    data: {
      organizationId: a.organizationId,
      athleteId: a.athlete.athleteId,
      exerciseKey: "squat",
      value: 100,
      kind: "one_rm",
      date: new Date("2030-01-01"),
    },
  });
  const replacement = await prisma.exercise.findFirstOrThrow({
    where: { organizationId: a.organizationId, id: { not: a.exercise.id } },
  });
  const draft = structuredClone(a.input.draft);
  draft.blocks[0]!.items[0]!.exerciseId = replacement.id;
  await saveScheduledSession(a.owner.userId, a.organizationId, { ...a.input, id: a.session.id, draft });
  const detail = await getAthleteSession(a.athlete.userId, a.organizationId, a.session.id);
  expect(detail.blocks[0]?.items[0]).toMatchObject({ exerciseId: a.exercise.id, resolvedLoadKg: 40 });
  await a.log({ expectedVersion: 1, expectedSessionVersion: 2 });
  const saved = await prisma.setLog.findFirstOrThrow({ where: { log: { scheduledSessionId: a.session.id } } });
  expect(saved.exerciseId).toBe(a.exercise.id);
});

it("les statistiques additionnent les deux séries réalisées et exposent leur couverture", async () => {
  const a = await setup();
  const base = {
    itemRef: "b0-i0",
    done: true,
    reps: 4,
    loadKg: 40,
    setKind: "work" as const,
    loadKind: "external" as const,
    repetitionScope: "total" as const,
    sideCount: 1 as const,
  };
  await a.log({
    status: "partial",
    detailedSets: [
      { ...base, setIndex: 0 },
      { ...base, setIndex: 1 },
      { ...base, setIndex: 2, done: false },
    ],
  });
  const stats = await athleteWeeklyStats(
    a.owner.userId,
    a.organizationId,
    a.athlete.athleteId,
    4,
    new Date("2030-06-13"),
  );
  expect(stats.weeks.at(-1)).toMatchObject({
    tonnageKg: 320,
    distanceM: null,
    coverage: { detailedSessions: 1, completedWorkSets: 2, tonnageKnownSets: 2 },
  });
});
