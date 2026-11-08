import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { resolveTrainingPhase } from "@tartan/domain";
import { type SaveTrainingPhaseInput } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import {
  listTrainingPhases,
  getTrainingPhaseContext,
  saveTrainingPhase,
  setTrainingPhaseVisibility,
  deleteTrainingPhase,
} from "@/server/training-phases.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";
import { exportMyData } from "@/server/export.service";

const setup = async () => {
  const org = await makeOrg("Phases");
  await prisma.organization.update({ where: { id: org.organizationId }, data: { phasesEnabled: true } });
  const athlete = await addAthlete(org.organizationId, org.groupId, "Camille");
  const input: SaveTrainingPhaseInput = {
    id: randomUUID(),
    expectedVersion: 0,
    target: { type: "group", id: org.groupId },
    name: "Développement",
    kind: "development",
    startDate: "2030-01-01",
    endDate: "2030-03-25",
    objective: "Force",
    description: "Description partageable",
    privateNote: "NOTE_STRICTEMENT_PRIVEE",
  };
  const query = { from: "2030-01-01", to: "2030-12-31" };
  const write = (extra: Partial<SaveTrainingPhaseInput> = {}) =>
    saveTrainingPhase(org.owner.userId, org.organizationId, { ...input, ...extra });
  return { ...org, athlete, input, query, write };
};
it("crée en privé, partage explicitement et ne sélectionne jamais la note pour un athlète", async () => {
  const a = await setup();
  await a.write();
  expect((await listTrainingPhases(a.athlete.userId, a.organizationId, a.query)).phases).toEqual([]);
  const shared = await setTrainingPhaseVisibility(a.owner.userId, a.organizationId, a.input.id, {
    expectedVersion: 1,
    shared: true,
  });
  expect(shared.version).toBe(2);
  const spy = vi.spyOn(prisma.trainingPhase, "findMany");
  try {
    const visible = await listTrainingPhases(a.athlete.userId, a.organizationId, a.query);
    expect(visible).toMatchObject({ canManage: false, phases: [{ name: "Développement", shared: true }] });
    expect(JSON.stringify(visible)).not.toContain("privateNote");
    expect(spy.mock.calls.every(([args]) => !args?.select || !("privateNote" in args.select))).toBe(true);
  } finally {
    spy.mockRestore();
  }
  expect((await listTrainingPhases(a.owner.userId, a.organizationId, a.query)).phases[0]?.privateNote).toBe(
    a.input.privateNote,
  );
  await setTrainingPhaseVisibility(a.owner.userId, a.organizationId, a.input.id, { expectedVersion: 2, shared: false });
  expect((await listTrainingPhases(a.athlete.userId, a.organizationId, a.query)).phases).toEqual([]);
});
it("les chevauchements sont refusés même en concurrence, les jours consécutifs restent possibles", async () => {
  const a = await setup();
  const results = await Promise.allSettled([a.write(), a.write({ id: randomUUID() })]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "phase_overlap" } });
  await expect(a.write({ id: randomUUID(), startDate: "2030-03-25", endDate: "2030-04-01" })).rejects.toMatchObject({
    code: "phase_overlap",
  });
  await a.write({ id: randomUUID(), startDate: "2030-03-26", endDate: "2030-04-01" });
  expect((await listTrainingPhases(a.owner.userId, a.organizationId, a.query)).phases).toHaveLength(2);
});
it("conserve l'absence de phase privée dans la vue athlète, y compris sa priorité", async () => {
  const a = await setup();
  await a.write();
  await setTrainingPhaseVisibility(a.owner.userId, a.organizationId, a.input.id, { expectedVersion: 1, shared: true });
  const before = await listTrainingPhases(a.athlete.userId, a.organizationId, a.query);
  const personal = await a.write({
    id: randomUUID(),
    target: { type: "athlete", id: a.athlete.athleteId },
    name: "NE_PAS_REVELER",
  });
  expect(await listTrainingPhases(a.athlete.userId, a.organizationId, a.query)).toEqual(before);
  const context = { date: "2030-01-15", athleteId: a.athlete.athleteId, groupIds: [a.groupId] };
  expect(resolveTrainingPhase(before.phases, context)).toMatchObject({ kind: "phase", phase: { id: a.input.id } });
  expect(
    resolveTrainingPhase((await listTrainingPhases(a.owner.userId, a.organizationId, a.query)).phases, context),
  ).toMatchObject({ kind: "phase", phase: { id: personal.id } });
  await setTrainingPhaseVisibility(a.owner.userId, a.organizationId, personal.id, { expectedVersion: 1, shared: true });
  expect(
    resolveTrainingPhase((await listTrainingPhases(a.athlete.userId, a.organizationId, a.query)).phases, context),
  ).toMatchObject({ kind: "phase", phase: { id: personal.id } });
});
it("refuse les écritures obsolètes, déduplique la création et ne ressuscite pas une phase supprimée", async () => {
  const a = await setup();
  const saved = await Promise.all([a.write(), a.write()]);
  expect(saved[0]).toEqual(saved[1]);
  await a.write({ expectedVersion: 1, name: "Corrigée" });
  expect(await a.write()).toMatchObject({ version: 2 });
  await expect(a.write({ expectedVersion: 1, name: "Écrasement" })).rejects.toMatchObject({ code: "phase_conflict" });
  await expect(
    deleteTrainingPhase(a.owner.userId, a.organizationId, a.input.id, { expectedVersion: 1 }),
  ).rejects.toMatchObject({ code: "phase_conflict" });
  await deleteTrainingPhase(a.owner.userId, a.organizationId, a.input.id, { expectedVersion: 2 });
  await deleteTrainingPhase(a.owner.userId, a.organizationId, a.input.id, { expectedVersion: 2 });
  await expect(a.write()).rejects.toMatchObject({ code: "phase_conflict" });
  expect((await listTrainingPhases(a.owner.userId, a.organizationId, a.query)).phases).toEqual([]);
  const removed = await prisma.trainingPhase.findUniqueOrThrow({ where: { id: a.input.id } });
  expect(removed).toMatchObject({ privateNote: "", description: "", name: "", createdBy: null });
  await a.write({ id: randomUUID() });
});
it("contrôle les deux cibles d'une réattribution, les groupes, les rôles et le drapeau", async () => {
  const a = await setup();
  const otherGroup = await prisma.group.create({ data: { organizationId: a.organizationId, name: "Autre groupe" } });
  const coach = await addStaff(a.organizationId, "Coach", "coach", [a.groupId]);
  const assistant = await addStaff(a.organizationId, "Assistant", "assistant", [a.groupId]);
  const forbiddenPhase = await a.write({ target: { type: "group", id: otherGroup.id } });
  await expect(
    saveTrainingPhase(coach.userId, a.organizationId, { ...a.input, id: forbiddenPhase.id, expectedVersion: 1 }),
  ).rejects.toMatchObject({ status: 403 });
  for (const userId of [assistant.userId, a.athlete.userId])
    await expect(saveTrainingPhase(userId, a.organizationId, a.input)).rejects.toMatchObject({ status: 403 });
  await expect(
    listTrainingPhases(coach.userId, a.organizationId, { ...a.query, groupId: otherGroup.id }),
  ).rejects.toMatchObject({ status: 403 });
  expect((await listTrainingPhases(assistant.userId, a.organizationId, a.query)).phases).toEqual([]);
  expect((await getTrainingPhaseContext(coach.userId, a.organizationId)).groups.map((g) => g.id)).toEqual([a.groupId]);
  await expect(getTrainingPhaseContext(a.athlete.userId, a.organizationId)).rejects.toMatchObject({ status: 403 });
  await prisma.organization.update({ where: { id: a.organizationId }, data: { phasesEnabled: false } });
  await expect(a.write({ id: randomUUID() })).rejects.toMatchObject({ code: "phases_disabled" });
  await expect(listTrainingPhases(a.owner.userId, a.organizationId, a.query)).rejects.toMatchObject({
    code: "phases_disabled",
  });
});

it("isole les espaces, recontrôle les accès révoqués et conserve les séances", async () => {
  const a = await setup();
  const b = await setup();
  const coach = await addStaff(a.organizationId, "CoachRévoqué", "coach", [a.groupId]);
  const session = await prisma.scheduledSession.create({
    data: {
      organizationId: a.organizationId,
      createdBy: a.owner.userId,
      date: new Date("2030-01-15"),
      title: "Séance indépendante",
      type: "strength",
      draft: { title: "Conserver ce contenu" },
      assignments: { create: { targetType: "group", targetId: a.groupId } },
    },
    include: { assignments: true },
  });
  await a.write();
  await expect(
    saveTrainingPhase(a.owner.userId, a.organizationId, {
      ...a.input,
      id: randomUUID(),
      target: { type: "group", id: b.groupId },
    }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(listTrainingPhases(b.owner.userId, a.organizationId, a.query)).rejects.toMatchObject({ status: 403 });
  await expect(
    deleteTrainingPhase(b.owner.userId, b.organizationId, a.input.id, { expectedVersion: 1 }),
  ).rejects.toMatchObject({ status: 404 });
  await prisma.groupCoach.deleteMany({ where: { groupId: a.groupId, userId: coach.userId } });
  await expect(
    setTrainingPhaseVisibility(coach.userId, a.organizationId, a.input.id, { expectedVersion: 1, shared: true }),
  ).rejects.toMatchObject({ status: 403 });
  expect((await listTrainingPhases(coach.userId, a.organizationId, a.query)).phases).toEqual([]);
  await a.write({ expectedVersion: 1, name: "Nouvelle phase" });
  await deleteTrainingPhase(a.owner.userId, a.organizationId, a.input.id, { expectedVersion: 2 });
  expect(
    await prisma.scheduledSession.findUnique({ where: { id: session.id }, include: { assignments: true } }),
  ).toEqual(session);
});

it("exporte les phases partagées sans les notes ni les phases privées, puis purge avec la fiche", async () => {
  const a = await setup();
  await a.write();
  await setTrainingPhaseVisibility(a.owner.userId, a.organizationId, a.input.id, { expectedVersion: 1, shared: true });
  const personal = await a.write({
    id: randomUUID(),
    target: { type: "athlete", id: a.athlete.athleteId },
    name: "CONFIDENTIEL",
  });
  const data = await exportMyData(a.athlete.userId);
  expect(data.athletes[0]!.groups[0]!.group.trainingPhases[0]!.name).toBe(a.input.name);
  expect(data.athletes[0]!.trainingPhases).toEqual([]);
  expect(JSON.stringify(data)).not.toContain("CONFIDENTIEL");
  expect(JSON.stringify(data)).not.toContain("NOTE_STRICTEMENT_PRIVEE");
  await setTrainingPhaseVisibility(a.owner.userId, a.organizationId, personal.id, { expectedVersion: 1, shared: true });
  expect((await exportMyData(a.athlete.userId)).athletes[0]!.trainingPhases).toHaveLength(1);
  await prisma.athlete.delete({ where: { id: a.athlete.athleteId } });
  expect(await prisma.trainingPhase.count({ where: { id: personal.id } })).toBe(0);
  expect(await prisma.trainingPhase.count({ where: { id: a.input.id } })).toBe(1);
});
