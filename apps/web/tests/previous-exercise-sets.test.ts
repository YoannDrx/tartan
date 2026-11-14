import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import type { DetailedSetInput } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { getAthleteSession, getAthleteSessionForCoach, logSession } from "@/server/athlete-view.service";
import { saveScheduledSession, publishRow } from "@/server/session.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";

const setup = async () => {
  const org = await makeOrg("Rappel");
  await prisma.organization.update({ where: { id: org.organizationId }, data: { progressionEnabled: true } });
  const athlete = await addAthlete(org.organizationId, org.groupId, "Athlète");
  const exercise = await prisma.exercise.findFirstOrThrow({
    where: { organizationId: org.organizationId, name: "Squat arrière" },
  });
  const create = async (date: string, startTime: string | null = null) => {
    const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
      date,
      startTime,
      location: null,
      publishAt: null,
      assignments: [{ targetType: "group", targetId: org.groupId }],
      overrides: [],
      draft: {
        title: "Force",
        type: "strength",
        durationMin: 45,
        coachNote: "PRIVE_RAPPEL",
        blocks: [
          {
            name: "Travail",
            variant: "club",
            items: [{ exerciseId: exercise.id, prescription: { sets: 3, reps: 4, load: { type: "kg", value: 100 } } }],
          },
        ],
      },
    });
    await publishRow(session.id, org.owner.userId, new Date("2020-01-01T10:00:00Z"), { silent: true });
    return session;
  };
  const read = (sessionId: string) => getAthleteSession(athlete.userId, org.organizationId, sessionId);
  const write = async (sessionId: string, sets: Partial<DetailedSetInput>[]) => {
    const detail = await read(sessionId);
    const ref = detail.blocks[0]!.items[0]!.ref;
    return logSession(athlete.userId, org.organizationId, sessionId, {
      clientId: randomUUID(),
      status: "partial",
      variantDone: "club",
      expectedVersion: detail.log?.version ?? 0,
      expectedSessionVersion: detail.sessionVersion,
      rpe: 7,
      comment: "SANTE_RAPPEL",
      detailedSets: sets.map((set, index) => ({
        itemRef: ref,
        setIndex: index,
        reps: 4,
        loadKg: 40,
        done: true,
        setKind: "work",
        loadKind: "external",
        repetitionScope: "total",
        sideCount: 1,
        ...set,
      })),
    });
  };
  return { ...org, athlete, exercise, create, read, write };
};

it("rappelle seulement le dernier travail antérieur sans changer la prescription ni sélectionner la santé", async () => {
  const a = await setup();
  const old = await a.create("2021-06-01");
  await a.write(old.id, [{ loadKg: 30 }]);
  const latest = await a.create("2029-06-01");
  await a.write(latest.id, [{}, {}, { setKind: "warmup", loadKg: 20 }, { done: false, loadKg: 50 }]);
  const future = await a.create("2031-06-01");
  await a.write(future.id, [{ loadKg: 90 }]);
  const target = await a.create("2030-06-01");
  await a.write(target.id, [{ loadKg: 80 }]);
  const result = await a.read(target.id);
  expect(result.blocks[0]?.items[0]?.resolvedLoadKg).toBe(100);
  expect(result.historyAthleteId).toBe(a.athlete.athleteId);
  expect(result.previousExerciseSets).toHaveLength(1);
  expect(result.previousExerciseSets?.[0]).toMatchObject({
    date: "2029-06-01",
    sessionId: latest.id,
    sets: [{ loadKg: 40 }, { loadKg: 40 }],
  });
  expect(JSON.stringify(result.previousExerciseSets)).not.toMatch(/SANTE_RAPPEL|PRIVE_RAPPEL|rpe|comment|pain/);
  const coach = await getAthleteSessionForCoach(a.owner.userId, a.organizationId, target.id, a.athlete.athleteId);
  expect(coach.previousExerciseSets).toEqual(result.previousExerciseSets);
  await a.write(latest.id, [{ loadKg: 45 }]);
  expect((await a.read(target.id)).previousExerciseSets?.[0]?.sets[0]?.loadKg).toBe(45);
  await a.write(latest.id, []);
  expect((await a.read(target.id)).previousExerciseSets?.[0]).toMatchObject({
    date: "2021-06-01",
    sets: [{ loadKg: 30 }],
  });
});

it("ordonne deux séances le même jour uniquement avec des horaires connus", async () => {
  const a = await setup();
  const yesterday = await a.create("2030-06-01");
  await a.write(yesterday.id, [{ loadKg: 30 }]);
  const morning = await a.create("2030-06-02", "09:00");
  await a.write(morning.id, [{ loadKg: 45 }]);
  const later = await a.create("2030-06-02", "15:00");
  await a.write(later.id, [{ loadKg: 60 }]);
  const unknown = await a.create("2030-06-02");
  await a.write(unknown.id, [{ loadKg: 70 }]);
  const target = await a.create("2030-06-02", "12:00");
  expect((await a.read(target.id)).previousExerciseSets?.[0]).toMatchObject({
    sessionId: morning.id,
    startTime: "09:00",
    sets: [{ loadKg: 45 }],
  });
  expect((await a.read(unknown.id)).previousExerciseSets?.[0]).toMatchObject({
    sessionId: yesterday.id,
    sets: [{ loadKg: 30 }],
  });
});

it("sépare les conventions et ne perd pas une ancienne série derrière des réalisations récentes différentes", async () => {
  const a = await setup();
  const total = await a.create("2021-06-01");
  await a.write(total.id, [{ loadKg: 30 }]);
  const side = await a.create("2029-06-01");
  await a.write(side.id, [{ loadKg: 20, repetitionScope: "per_side", sideCount: 2 }]);
  const assistance = await a.create("2029-06-02");
  await a.write(assistance.id, [{ loadKind: "assisted", loadKg: 10 }]);
  const legacy = await a.create("2029-06-03");
  await a.write(legacy.id, [{ loadKg: 80 }]);
  await prisma.setLog.updateMany({ where: { log: { scheduledSessionId: legacy.id } }, data: { setKind: null } });
  const mismatch = await a.create("2029-06-04");
  await a.write(mismatch.id, [{ loadKg: 90 }]);
  const log = await prisma.sessionLog.findFirstOrThrow({ where: { scheduledSessionId: mismatch.id } });
  const snapshot = log.prescriptionSnapshot as { blocks: { items: { strengthLoadKind: string }[] }[] };
  snapshot.blocks[0]!.items[0]!.strengthLoadKind = "added_weight";
  await prisma.sessionLog.update({ where: { id: log.id }, data: { prescriptionSnapshot: snapshot } });
  const target = await a.create("2030-06-01");
  const groups = (await a.read(target.id)).previousExerciseSets!;
  expect(groups).toHaveLength(3);
  expect(groups.map((group) => group.sets[0]?.loadKg).sort((a, b) => a! - b!)).toEqual([10, 20, 30]);
});

it("respecte les droits de lecture de la séance, de l’athlète, de l’espace et le drapeau", async () => {
  const a = await setup();
  const previous = await a.create("2029-06-01");
  await a.write(previous.id, [{}]);
  const target = await a.create("2030-06-01");
  const other = await addAthlete(a.organizationId, a.groupId, "Autre");
  expect((await getAthleteSession(other.userId, a.organizationId, target.id)).previousExerciseSets).toEqual([]);
  const staff = await addStaff(a.organizationId, "Hors groupe", "coach");
  await expect(
    getAthleteSessionForCoach(staff.userId, a.organizationId, target.id, a.athlete.athleteId),
  ).rejects.toMatchObject({ status: 403 });
  const outside = await makeOrg("Externe");
  await expect(
    getAthleteSessionForCoach(outside.owner.userId, a.organizationId, target.id, a.athlete.athleteId),
  ).rejects.toMatchObject({ status: 403 });
  await prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId: a.organizationId, userId: a.athlete.userId } },
    data: { status: "suspended" },
  });
  await expect(a.read(target.id)).rejects.toMatchObject({ status: 403 });
  await prisma.organization.update({ where: { id: a.organizationId }, data: { progressionEnabled: false } });
  const disabled = await getAthleteSessionForCoach(a.owner.userId, a.organizationId, target.id, a.athlete.athleteId);
  expect(disabled.previousExerciseSets).toBeUndefined();
  expect(disabled.historyAthleteId).toBeUndefined();
});

it("borne le rappel sans masquer le nombre total de séries de la réalisation retenue", async () => {
  const a = await setup();
  const previous = await a.create("2029-06-01");
  await a.write(
    previous.id,
    Array.from({ length: 20 }, () => ({ loadKg: 30 })),
  );
  const target = await a.create("2030-06-01");
  const reminder = (await a.read(target.id)).previousExerciseSets![0]!;
  expect(reminder.totalSets).toBe(20);
  expect(reminder.sets).toHaveLength(12);
  expect(reminder.sets.map((set) => set.setIndex)).toEqual(Array.from({ length: 12 }, (_, index) => index));
});

it("rappelle les séries d'un circuit dans l'ordre des tours, le dixième après le deuxième", async () => {
  const a = await setup();
  const previous = await saveScheduledSession(a.owner.userId, a.organizationId, {
    date: "2029-06-01",
    startTime: null,
    location: null,
    publishAt: null,
    assignments: [{ targetType: "group", targetId: a.groupId }],
    overrides: [],
    draft: {
      structureVersion: 2,
      title: "Circuit",
      type: "strength",
      durationMin: 45,
      coachNote: null,
      blocks: [
        {
          ref: "bloc",
          name: "Travail",
          variant: "club",
          items: [{ ref: "squat", exerciseId: a.exercise.id, prescription: { sets: 1, reps: 4 } }],
          sequence: [
            { kind: "repeat", ref: "tours", name: "Circuit", rounds: 12, restBetweenRoundsS: 0, children: [{ kind: "exercise", itemRef: "squat" }] },
          ],
        },
      ],
    },
  });
  await publishRow(previous.id, a.owner.userId, new Date("2020-01-01T10:00:00Z"), { silent: true });
  const detail = await a.read(previous.id);
  const occurrences = detail.blocks[0]!.items;
  await logSession(a.athlete.userId, a.organizationId, previous.id, {
    clientId: randomUUID(),
    status: "partial",
    variantDone: "club",
    expectedVersion: 0,
    expectedSessionVersion: detail.sessionVersion,
    detailedSets: occurrences.map((item, round) => ({
      itemRef: item.ref,
      setIndex: 0,
      reps: 4,
      loadKg: 50 + round,
      done: true,
      setKind: "work",
      loadKind: "external",
      repetitionScope: "total",
      sideCount: 1,
    })),
  });
  const target = await a.create("2030-06-01");
  const reminder = (await a.read(target.id)).previousExerciseSets![0]!;
  expect(reminder.totalSets).toBe(12);
  expect(reminder.sets.map((set) => set.loadKg)).toEqual(Array.from({ length: 12 }, (_, round) => 50 + round));
});
