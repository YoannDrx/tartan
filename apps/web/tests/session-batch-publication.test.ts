import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { publishSessionsInput } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { publishSessions, saveScheduledSession, getSessionForEdit, listCalendar } from "@/server/session.service";
import { saveTrainingPhase } from "@/server/training-phases.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";
const failures = vi.hoisted(() => ({ queue: false, dispatch: false }));
vi.mock("@/server/notify.service", async (original) => {
  const actual = await original<typeof import("@/server/notify.service")>();
  return {
    ...actual,
    queueNotifications: async (...args: Parameters<typeof actual.queueNotifications>) => {
      if (failures.queue) throw new Error("OUTBOX_UNAVAILABLE");
      return actual.queueNotifications(...args);
    },
    dispatchPending: async () => {
      if (failures.dispatch) throw new Error("DELIVERY_UNAVAILABLE");
      return 0;
    },
  };
});
beforeEach(() => {
  failures.queue = false;
  failures.dispatch = false;
});
const range = { from: "2030-06-01", to: "2030-06-30" };
async function setup() {
  const a = await makeOrg("Lot");
  await prisma.organization.update({ where: { id: a.organizationId }, data: { progressionEnabled: true } });
  const athlete = await addAthlete(a.organizationId, a.groupId, "Ada");
  const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: a.organizationId } });
  const create = (title: string) =>
    saveScheduledSession(a.owner.userId, a.organizationId, {
      date: "2030-06-12",
      startTime: null,
      location: null,
      publishAt: null,
      overrides: [],
      assignments: [{ targetType: "group", targetId: a.groupId }],
      draft: {
        title,
        type: "strength",
        durationMin: 40,
        coachNote: null,
        blocks: [
          { name: "Force", variant: "club", items: [{ exerciseId: exercise.id, prescription: { sets: 3, reps: 4 } }] },
        ],
      },
    });
  const sessions = await Promise.all([create("Force A"), create("Force B")]);
  const input = { sessions: sessions.map((s) => ({ id: s.id, expectedVersion: s.version })) };
  const publish = () => publishSessions(a.owner.userId, a.organizationId, input, new Date("2030-06-01T12:00:00Z"));
  return { ...a, athlete, sessions, input, publish };
}
it("publie atomiquement, regroupe deux séances du même jour et résiste à la concurrence et réponse perdue", async () => {
  const a = await setup();
  const [one, two] = await Promise.all([a.publish(), a.publish()]);
  expect(two).toEqual(one);
  expect(await a.publish()).toEqual(one);
  expect(
    await prisma.sessionPrescription.count({ where: { scheduledSessionId: { in: a.sessions.map((s) => s.id) } } }),
  ).toBe(2);
  const notifications = await prisma.notification.findMany({
    where: { userId: a.athlete.userId, type: "session_batch_published" },
  });
  expect(notifications).toHaveLength(1);
  expect(notifications[0]?.payload).toMatchObject({ count: 2, organizationId: a.organizationId });
  expect(one.sessions.map((s) => s.version)).toEqual([2, 2]);
});
it("annule tout si une version change, puis refuse un rejeu devenu obsolète sans écraser", async () => {
  const a = await setup();
  await prisma.scheduledSession.update({ where: { id: a.sessions[1]!.id }, data: { version: { increment: 1 } } });
  await expect(a.publish()).rejects.toMatchObject({ status: 409 });
  expect(
    await prisma.scheduledSession.count({ where: { organizationId: a.organizationId, publishedAt: { not: null } } }),
  ).toBe(0);
  expect(
    await prisma.sessionPrescription.count({ where: { scheduledSessionId: { in: a.sessions.map((s) => s.id) } } }),
  ).toBe(0);
  a.input.sessions[1]!.expectedVersion++;
  await a.publish();
  await prisma.scheduledSession.update({
    where: { id: a.sessions[0]!.id },
    data: { version: { increment: 1 }, title: "Correction après publication" },
  });
  await expect(a.publish()).rejects.toMatchObject({ status: 409 });
  expect((await prisma.scheduledSession.findUniqueOrThrow({ where: { id: a.sessions[0]!.id } })).title).toBe(
    "Correction après publication",
  );
});
it("une panne d’outbox annule les publications ; une panne de livraison laisse une file durable", async () => {
  const a = await setup();
  failures.queue = true;
  await expect(a.publish()).rejects.toThrow("OUTBOX_UNAVAILABLE");
  expect(
    await prisma.scheduledSession.count({ where: { organizationId: a.organizationId, publishedAt: { not: null } } }),
  ).toBe(0);
  failures.queue = false;
  failures.dispatch = true;
  await expect(a.publish()).resolves.toHaveProperty("sessions");
  expect(
    await prisma.notification.count({ where: { userId: a.athlete.userId, type: "session_batch_published" } }),
  ).toBe(1);
  await a.publish();
  expect(
    await prisma.notification.count({ where: { userId: a.athlete.userId, type: "session_batch_published" } }),
  ).toBe(1);
});
it("refuse tout le lot hors espace, après révocation ou avec un adjoint non auteur", async () => {
  const a = await setup(),
    foreign = await makeOrg("EtrangerLot");
  const assistant = await addStaff(a.organizationId, "AdjointLot", "assistant", [a.groupId]);
  const calendar = await listCalendar(assistant.userId, a.organizationId, range);
  expect(calendar.sessions.every((s) => s.canPublish === false)).toBe(true);
  await expect(publishSessions(assistant.userId, a.organizationId, a.input)).rejects.toMatchObject({ status: 403 });
  await expect(publishSessions(foreign.owner.userId, foreign.organizationId, a.input)).rejects.toMatchObject({
    status: 404,
  });
  await prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId: a.organizationId, userId: a.owner.userId } },
    data: { status: "suspended" },
  });
  await expect(a.publish()).rejects.toMatchObject({ status: 403 });
  expect(
    await prisma.scheduledSession.count({ where: { organizationId: a.organizationId, publishedAt: { not: null } } }),
  ).toBe(0);
});
it("une phase ambiguë bloque le lot entier et conserve les brouillons", async () => {
  const a = await setup();
  await prisma.organization.update({ where: { id: a.organizationId }, data: { phasesEnabled: true } });
  const other = await prisma.group.create({ data: { organizationId: a.organizationId, name: "Second groupe" } });
  await prisma.groupMember.create({ data: { groupId: other.id, athleteId: a.athlete.athleteId } });
  for (const groupId of [a.groupId, other.id])
    await saveTrainingPhase(a.owner.userId, a.organizationId, {
      id: randomUUID(),
      expectedVersion: 0,
      name: "Développement",
      kind: "development",
      target: { type: "group", id: groupId },
      startDate: range.from,
      endDate: range.to,
      objective: "",
      description: "",
      privateNote: "",
    });
  const edit = await getSessionForEdit(a.owner.userId, a.organizationId, a.sessions[1]!.id);
  const updated = await saveScheduledSession(a.owner.userId, a.organizationId, {
    ...edit,
    assignments: [...edit.assignments, { targetType: "group", targetId: other.id }],
  });
  a.input.sessions[1]!.expectedVersion = updated.version;
  await expect(a.publish()).rejects.toMatchObject({ status: 409 });
  expect(
    await prisma.scheduledSession.count({ where: { organizationId: a.organizationId, publishedAt: { not: null } } }),
  ).toBe(0);
});
it("borne les requêtes et refuse les doublons avant écriture", () => {
  const row = { id: randomUUID(), expectedVersion: 1 };
  expect(publishSessionsInput.safeParse({ sessions: [] }).success).toBe(false);
  expect(publishSessionsInput.safeParse({ sessions: [row, row] }).success).toBe(false);
  expect(
    publishSessionsInput.safeParse({ sessions: Array.from({ length: 15 }, () => ({ ...row, id: randomUUID() })) })
      .success,
  ).toBe(false);
});
