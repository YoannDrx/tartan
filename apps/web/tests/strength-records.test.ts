import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { type DetailedSetInput, type SessionLogInput, sessionLogResult, sessionSnapshot } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { logSession, logSessionForAthlete } from "@/server/athlete-view.service";
import { getAthleteExerciseHistory } from "@/server/exercise-history.service";
import { saveScheduledSession, publishRow, deleteSession } from "@/server/session.service";
import { addAthlete, makeOrg } from "./helpers";

const set = (loadKg: number): DetailedSetInput => ({
  itemRef: "b0-i0",
  setIndex: 0,
  reps: 4,
  loadKg,
  done: true,
  setKind: "work",
  loadKind: "external",
  repetitionScope: "total",
  sideCount: 1,
});
const setup = async () => {
  const org = await makeOrg("Records");
  await prisma.organization.update({ where: { id: org.organizationId }, data: { progressionEnabled: true } });
  const athlete = await addAthlete(org.organizationId, org.groupId, "Sportif");
  const exercise = await prisma.exercise.findFirstOrThrow({
    where: { organizationId: org.organizationId, name: "Squat arrière" },
  });
  const create = async (date: string, value: number) => {
    const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
      date,
      startTime: "18:00",
      location: null,
      publishAt: null,
      assignments: [{ targetType: "athlete", targetId: athlete.athleteId }],
      overrides: [],
      draft: {
        title: "Force",
        type: "strength",
        durationMin: 30,
        coachNote: "NE_PAS_EXPOSER",
        blocks: [
          {
            name: "Force",
            variant: "club",
            items: [{ exerciseId: exercise.id, prescription: { sets: 1, reps: 4, load: { type: "kg", value: 200 } } }],
          },
        ],
      },
    });
    await publishRow(session.id, org.owner.userId, new Date("2020-01-01T12:00:00Z"), { silent: true });
    const input: SessionLogInput = {
      clientId: randomUUID(),
      status: "done",
      variantDone: "club",
      expectedVersion: 0,
      expectedSessionVersion: 2,
      detailedSets: [set(value)],
      comment: "COMMENTAIRE_PRIVE",
    };
    const write = (extra: Partial<SessionLogInput> = {}) =>
      logSession(athlete.userId, org.organizationId, session.id, { ...input, ...extra });
    return { session, input, write };
  };
  const read = () =>
    getAthleteExerciseHistory(athlete.userId, org.organizationId, athlete.athleteId, exercise.id, {
      from: "2030-06-01",
      to: "2030-06-30",
    });
  return { ...org, athlete, exercise, create, read };
};

it("compare à tout l’historique, confirme après écriture et ne rejoue aucun événement", async () => {
  const a = await setup();
  const old = await a.create("2021-01-01", 80);
  expect(sessionLogResult.parse(await old.write()).records).toEqual([]);
  const recent = await a.create("2030-06-12", 60);
  expect(sessionLogResult.parse(await recent.write()).records).toEqual([]);
  let history = await a.read();
  expect(history.sessions).toHaveLength(1);
  expect(history.records?.find((r) => r.kind === "load_at_reps")).toMatchObject({
    value: 80,
    date: "2021-01-01",
    baseline: true,
  });
  const mutation = { clientId: randomUUID(), expectedVersion: 1, detailedSets: [set(90)] };
  const improved = sessionLogResult.parse(await recent.write(mutation));
  expect(improved.records).toHaveLength(2);
  expect(improved.records?.find((r) => r.kind === "load_at_reps")).toMatchObject({
    value: 90,
    previousValue: 80,
    logVersion: 2,
    baseline: false,
  });
  expect(sessionLogResult.parse(await recent.write(mutation))).toMatchObject({ replayed: true, records: [] });
  history = await a.read();
  expect(history.records?.find((r) => r.kind === "load_at_reps")).toMatchObject({
    value: 90,
    date: "2030-06-12",
    baseline: false,
  });
  expect(JSON.stringify(improved)).not.toContain("PRIVE");
  expect(JSON.stringify(history.records)).not.toContain("NE_PAS_EXPOSER");
  const corrected = sessionLogResult.parse(
    await recent.write({ clientId: randomUUID(), expectedVersion: 2, detailedSets: [set(70)] }),
  );
  expect(corrected.records).toEqual([]);
  expect((await a.read()).records?.find((r) => r.kind === "load_at_reps")?.value).toBe(80);
  await deleteSession(a.owner.userId, a.organizationId, old.session.id, { expectedVersion: 2, expectedLogCount: 1 });
  expect((await a.read()).records?.find((r) => r.kind === "load_at_reps")).toMatchObject({ value: 70, baseline: true });
});

it("refuse les autres espaces et conserve le contrôle du drapeau et du rôle", async () => {
  const a = await setup();
  const session = await a.create("2030-06-12", 50);
  await session.write();
  const outsider = await makeOrg("Autre");
  await expect(
    logSessionForAthlete(outsider.owner.userId, a.organizationId, session.session.id, a.athlete.athleteId, {
      ...session.input,
      clientId: randomUUID(),
      expectedVersion: 1,
    }),
  ).rejects.toThrow();
  await expect(
    getAthleteExerciseHistory(outsider.owner.userId, a.organizationId, a.athlete.athleteId, a.exercise.id, {
      from: "2030-06-01",
      to: "2030-06-30",
    }),
  ).rejects.toThrow();
  await prisma.organization.update({ where: { id: a.organizationId }, data: { progressionEnabled: false } });
  await expect(a.read()).rejects.toMatchObject({ status: 409 });
});

it("la concurrence ne crée qu’une amélioration et une correction de première référence n’est pas un record", async () => {
  const a = await setup();
  const first = await a.create("2021-01-01", 40);
  await first.write();
  expect(
    sessionLogResult.parse(await first.write({ clientId: randomUUID(), expectedVersion: 1, detailedSets: [set(50)] }))
      .records,
  ).toEqual([]);
  const second = await a.create("2030-06-12", 60);
  const result = await Promise.all([second.write(), second.write()]);
  expect(result.filter((value) => value.replayed)).toHaveLength(1);
  expect(result.flatMap((value) => sessionLogResult.parse(value).records ?? [])).toHaveLength(2);
});

it("parcourt toutes les pages et ne perd pas le maximum placé après les 500 premières séries", async () => {
  const a = await setup();
  const current = await a.create("2030-06-12", 40);
  const saved = await current.write();
  const log = await prisma.sessionLog.findUniqueOrThrow({ where: { id: saved.id } });
  const snapshot = sessionSnapshot.parse(log.prescriptionSnapshot);
  const source = snapshot.blocks[0]!.items[0]!;
  snapshot.blocks[0]!.items = Array.from({ length: 6 }, (_, index) => ({ ...source, ref: `record-item-${index}` }));
  await prisma.sessionLog.update({
    where: { id: log.id },
    data: { prescriptionSnapshot: JSON.parse(JSON.stringify(snapshot)) },
  });
  await prisma.setLog.deleteMany({ where: { sessionLogId: log.id } });
  await prisma.setLog.createMany({
    data: Array.from({ length: 501 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      sessionLogId: log.id,
      exerciseId: a.exercise.id,
      itemRef: `record-item-${Math.floor(index / 100)}`,
      setIndex: index % 100,
      reps: 4,
      loadKg: index === 500 ? 99 : 40,
      done: true,
      setKind: "work",
      loadKind: "external",
      repetitionScope: "total",
      sideCount: 1,
    })),
  });
  expect((await a.read()).records?.find((record) => record.kind === "load_at_reps")).toMatchObject({
    value: 99,
    setIndex: 0,
    itemRef: "record-item-5",
  });
});
