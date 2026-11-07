import { beforeEach, expect, it, vi } from "vitest";
import { deleteSessionQuery, sessionDraft } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { getSessionBuilderContext } from "@/server/session-builder.service";
import {
  deleteSession,
  deleteTemplate,
  getSessionForEdit,
  listTemplates,
  publishRow,
  saveScheduledSession,
  saveTemplate,
} from "@/server/session.service";
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
      if (failures.dispatch) throw new Error("PROVIDER_UNAVAILABLE");
      return 0;
    },
  };
});
beforeEach(() => {
  failures.queue = false;
  failures.dispatch = false;
});

const setup = async () => {
  const a = await makeOrg("Suppression");
  const athlete = await addAthlete(a.organizationId, a.groupId, "Destinataire");
  const context = await getSessionBuilderContext(a.owner.userId, a.organizationId);
  const draft = sessionDraft.parse({
    title: "Séance à relire",
    type: "strength",
    durationMin: 30,
    coachNote: null,
    blocks: [
      { name: "Force", variant: "club", items: [{ exerciseId: context.exercises[0]!.id, prescription: { reps: 4 } }] },
    ],
  });
  const saved = await saveScheduledSession(a.owner.userId, a.organizationId, {
    date: "2030-06-12",
    startTime: null,
    location: null,
    publishAt: null,
    draft,
    assignments: [{ targetType: "group", targetId: a.groupId }],
    overrides: [],
  });
  await publishRow(saved.id, a.owner.userId, new Date(), { silent: true });
  const edit = await getSessionForEdit(a.owner.userId, a.organizationId, saved.id);
  return {
    ...a,
    athlete,
    draft,
    edit,
    confirmation: { expectedVersion: edit.version, expectedLogCount: edit.logCount },
  };
};

it("une séance modifiée après la confirmation ne peut pas être supprimée", async () => {
  const a = await setup();
  await saveScheduledSession(a.owner.userId, a.organizationId, {
    ...a.edit,
    draft: { ...a.edit.draft, title: "Modification concurrente" },
  });
  await expect(deleteSession(a.owner.userId, a.organizationId, a.edit.id, a.confirmation)).rejects.toMatchObject({
    status: 409,
  });
  expect((await prisma.scheduledSession.findUniqueOrThrow({ where: { id: a.edit.id } })).title).toBe(
    "Modification concurrente",
  );
  expect(await prisma.notification.count({ where: { userId: a.athlete.userId, type: "session_cancelled" } })).toBe(0);
});

it("une nouvelle validation impose une relecture avant suppression de ses données", async () => {
  const a = await setup();
  await prisma.sessionLog.create({
    data: { scheduledSessionId: a.edit.id, athleteId: a.athlete.athleteId, status: "done", variantDone: "club" },
  });
  await expect(deleteSession(a.owner.userId, a.organizationId, a.edit.id, a.confirmation)).rejects.toMatchObject({
    status: 409,
  });
  expect(await prisma.sessionLog.count({ where: { scheduledSessionId: a.edit.id } })).toBe(1);
  await deleteSession(a.owner.userId, a.organizationId, a.edit.id, { ...a.confirmation, expectedLogCount: 1 });
  expect(await prisma.sessionLog.count({ where: { scheduledSessionId: a.edit.id } })).toBe(0);
  expect(await prisma.auditLog.count({ where: { entityId: a.edit.id, action: "session_deleted" } })).toBe(1);
});

it("deux suppressions concurrentes n'émettent qu'une seule annulation", async () => {
  const a = await setup();
  const results = await Promise.allSettled(
    [1, 2].map(() => deleteSession(a.owner.userId, a.organizationId, a.edit.id, a.confirmation)),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await prisma.notification.count({ where: { userId: a.athlete.userId, type: "session_cancelled" } })).toBe(1);
});

it("une panne de file annule aussi la suppression, une panne prestataire laisse une reprise durable", async () => {
  const a = await setup();
  failures.queue = true;
  await expect(deleteSession(a.owner.userId, a.organizationId, a.edit.id, a.confirmation)).rejects.toThrow(
    "OUTBOX_UNAVAILABLE",
  );
  expect(await prisma.scheduledSession.count({ where: { id: a.edit.id } })).toBe(1);
  expect(await prisma.assignment.count({ where: { scheduledSessionId: a.edit.id } })).toBe(1);
  failures.queue = false;
  failures.dispatch = true;
  await deleteSession(a.owner.userId, a.organizationId, a.edit.id, a.confirmation);
  expect(await prisma.scheduledSession.count({ where: { id: a.edit.id } })).toBe(0);
  const notification = await prisma.notification.findFirstOrThrow({
    where: { userId: a.athlete.userId, type: "session_cancelled" },
  });
  expect(notification.sentAt).toBeNull();
  expect(notification.payload).toEqual({ date: "2030-06-12", organizationId: a.organizationId, link: "/aujourdhui" });
});

it("les droits d'espace, de rôle et de groupe restent requis pour supprimer", async () => {
  const a = await setup();
  const other = await makeOrg("AutreSuppression");
  const assistant = await addStaff(a.organizationId, "Adjoint", "assistant", [a.groupId]);
  const coach = await addStaff(a.organizationId, "HorsGroupe", "coach");
  for (const userId of [a.athlete.userId, other.owner.userId, assistant.userId, coach.userId])
    await expect(deleteSession(userId, a.organizationId, a.edit.id, a.confirmation)).rejects.toMatchObject({
      status: 403,
    });
  expect(await prisma.scheduledSession.count({ where: { id: a.edit.id } })).toBe(1);
});

it("retirer un modèle préserve les séances et les autres modèles, avec permission explicite", async () => {
  const a = await setup();
  const coach = await addStaff(a.organizationId, "AuteurModele", "coach", [a.groupId]);
  const own = await saveTemplate(coach.userId, a.organizationId, a.draft);
  const owner = await saveTemplate(a.owner.userId, a.organizationId, a.draft);
  const models = await listTemplates(coach.userId, a.organizationId);
  expect(models.find((t) => t.id === own.id)?.canDelete).toBe(true);
  expect(models.find((t) => t.id === owner.id)?.canDelete).toBe(false);
  await expect(deleteTemplate(coach.userId, a.organizationId, owner.id)).rejects.toMatchObject({ status: 403 });
  await expect(deleteTemplate(a.athlete.userId, a.organizationId, own.id)).rejects.toMatchObject({ status: 403 });
  const other = await makeOrg("AutreModele");
  await expect(deleteTemplate(other.owner.userId, other.organizationId, own.id)).rejects.toMatchObject({ status: 404 });
  await deleteTemplate(coach.userId, a.organizationId, own.id);
  expect(await prisma.sessionTemplate.count({ where: { id: owner.id } })).toBe(1);
  expect(await prisma.scheduledSession.count({ where: { id: a.edit.id } })).toBe(1);
  expect((await getSessionForEdit(a.owner.userId, a.organizationId, a.edit.id)).draft).toEqual(a.edit.draft);
});

it("les anciennes requêtes restent lisibles, les confirmations incomplètes ou invalides sont refusées", () => {
  expect(deleteSessionQuery.parse({})).toEqual({});
  expect(deleteSessionQuery.parse({ expectedVersion: "2", expectedLogCount: "0" })).toEqual({
    expectedVersion: 2,
    expectedLogCount: 0,
  });
  for (const input of [
    { expectedVersion: "2" },
    { expectedLogCount: "0" },
    { expectedVersion: "0", expectedLogCount: "0" },
    { expectedVersion: "2", expectedLogCount: "-1" },
  ])
    expect(deleteSessionQuery.safeParse(input).success).toBe(false);
});

it("un ancien client peut encore supprimer une séance inchangée", async () => {
  const a = await setup();
  await deleteSession(a.owner.userId, a.organizationId, a.edit.id);
  expect(await prisma.scheduledSession.count({ where: { id: a.edit.id } })).toBe(0);
  expect(await prisma.notification.count({ where: { userId: a.athlete.userId, type: "session_cancelled" } })).toBe(1);
});
