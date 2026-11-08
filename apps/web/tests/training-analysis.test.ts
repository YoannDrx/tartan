import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getTrainingAnalysisContext, getTrainingAnalysis } from "@/server/training-analysis.service";
import { getAthleteSession, logSession } from "@/server/athlete-view.service";
import { publishRow, saveScheduledSession } from "@/server/session.service";
import { saveTrainingPhase, setTrainingPhaseVisibility } from "@/server/training-phases.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";
const period = { from: "2030-06-01", to: "2030-06-28" };
async function setup() {
  const org = await makeOrg("Analyse");
  await prisma.organization.update({
    where: { id: org.organizationId },
    data: { progressionEnabled: true, phasesEnabled: true },
  });
  const athlete = await addAthlete(org.organizationId, org.groupId, "Ada");
  const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: org.organizationId } });
  await prisma.exercise.update({ where: { id: exercise.id }, data: { strengthLoadKind: "external_total" } });
  const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
    date: "2030-06-12",
    startTime: null,
    location: null,
    publishAt: null,
    overrides: [],
    assignments: [{ targetType: "group", targetId: org.groupId }],
    draft: {
      title: "Force",
      type: "strength",
      durationMin: 45,
      coachNote: "Interne séance",
      blocks: [
        {
          name: "Force",
          variant: "club",
          items: [{ exerciseId: exercise.id, prescription: { sets: 3, reps: 4, load: { type: "kg", value: 40 } } }],
        },
      ],
    },
  });
  await publishRow(session.id, org.owner.userId, new Date("2030-06-01T10:00:00Z"), { silent: true });
  const detail = await getAthleteSession(athlete.userId, org.organizationId, session.id);
  const log = () =>
    logSession(athlete.userId, org.organizationId, session.id, {
      clientId: randomUUID(),
      status: "partial",
      variantDone: "club",
      expectedVersion: 0,
      expectedSessionVersion: detail.sessionVersion,
      rpe: 8,
      durationMin: 45,
      detailedSets: [0, 1].map((setIndex) => ({
        itemRef: "b0-i0",
        setIndex,
        reps: 4,
        loadKg: 40,
        done: true,
        setKind: "work" as const,
        loadKind: "external" as const,
        repetitionScope: "total" as const,
        sideCount: 1 as const,
      })),
    });
  return { ...org, athlete, exercise, session, log };
}
it("compare prévu/réalisé, couverture, historique figé et unités sans consulter les maxima", async () => {
  const a = await setup();
  await a.log();
  const spy = vi.spyOn(prisma.strengthTest, "findMany");
  const data = await getTrainingAnalysis(a.owner.userId, a.organizationId, period);
  expect(data.totals).toMatchObject({
    assignedSessions: 1,
    loggedSessions: 1,
    completedSessions: 1,
    frozenSessions: 1,
    planned: { tonnageKg: 480 },
    actual: { tonnageKg: 320 },
    perceivedLoad: 360,
    loadResponses: 1,
  });
  expect(data.previous.actual.tonnageKg).toBeNull();
  expect(data.exercises[0]).toMatchObject({ exerciseId: a.exercise.id, occurrences: 1, completedWorkSets: 2 });
  expect(data.diversity28Days.distinctExercises).toBe(1);
  expect(JSON.stringify(data)).not.toContain("Interne séance");
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});
it("une absence de saisie reste manquante et une arrivée tardive ne reçoit pas le passé", async () => {
  const a = await setup();
  await addAthlete(a.organizationId, a.groupId, "Après", { joinedAt: new Date("2030-06-20T10:00:00Z") });
  const data = await getTrainingAnalysis(a.owner.userId, a.organizationId, period);
  expect(data.athleteCount).toBe(2);
  expect(data.totals).toMatchObject({ assignedSessions: 1, loggedSessions: 0, actual: { tonnageKg: null } });
});
it("refuse les accès inter-espace, autres athlètes, groupe hors périmètre et flag éteint", async () => {
  const a = await setup();
  const other = await makeOrg("Autre");
  const coach = await addStaff(a.organizationId, "Limité", "coach", []);
  await expect(getTrainingAnalysis(other.owner.userId, a.organizationId, period)).rejects.toMatchObject({
    status: 403,
  });
  await expect(
    getTrainingAnalysis(coach.userId, a.organizationId, { ...period, groupId: a.groupId }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    getTrainingAnalysis(a.athlete.userId, a.organizationId, { ...period, athleteId: randomUUID() }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    getTrainingAnalysis(a.owner.userId, a.organizationId, { ...period, groupId: other.groupId }),
  ).rejects.toMatchObject({ status: 404 });
  await prisma.organization.update({ where: { id: a.organizationId }, data: { progressionEnabled: false } });
  await expect(getTrainingAnalysis(a.owner.userId, a.organizationId, period)).rejects.toMatchObject({
    code: "progression_disabled",
  });
});
it("ne lit pas les colonnes santé sans consentement et journalise leur lecture autorisée", async () => {
  const a = await setup();
  await a.log();
  await getTrainingAnalysis(a.owner.userId, a.organizationId, period);
  expect(
    await prisma.auditLog.count({
      where: { organizationId: a.organizationId, action: "health_read", entity: "training_analysis" },
    }),
  ).toBe(1);
  const { setConsent } = await import("@/server/consent.service");
  await setConsent(a.athlete.userId, "health", false, a.athlete.athleteId);
  const spy = vi.spyOn(prisma.sessionLog, "findMany");
  const data = await getTrainingAnalysis(a.owner.userId, a.organizationId, period);
  expect(data.healthVisible).toBe(false);
  expect(data.totals.perceivedLoad).toBeNull();
  expect(data.weeks.every((week) => week.totals.perceivedLoad === null && week.totals.loadResponses === 0)).toBe(true);
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});
it("filtre la période d'une phase sans exposer une phase privée à l'athlète", async () => {
  const a = await setup();
  const phase = await saveTrainingPhase(a.owner.userId, a.organizationId, {
    id: randomUUID(),
    expectedVersion: 0,
    target: { type: "group", id: a.groupId },
    name: "Force",
    kind: "development",
    startDate: "2030-06-10",
    endDate: "2030-06-20",
    objective: "",
    description: "",
    privateNote: "Secret",
  });
  await expect(
    getTrainingAnalysis(a.athlete.userId, a.organizationId, { ...period, phaseId: phase.id }),
  ).rejects.toMatchObject({ status: 404 });
  const data = await getTrainingAnalysis(a.owner.userId, a.organizationId, { ...period, phaseId: phase.id });
  expect(data).toMatchObject({ from: "2030-06-10", to: "2030-06-20", phase: { name: "Force" } });
  expect(JSON.stringify(data)).not.toContain("Secret");
  await setTrainingPhaseVisibility(a.owner.userId, a.organizationId, phase.id, {
    expectedVersion: phase.version,
    shared: true,
  });
  expect(
    (await getTrainingAnalysis(a.athlete.userId, a.organizationId, { ...period, phaseId: phase.id })).athleteCount,
  ).toBe(1);
});
it.each([30, 60, 120])(
  "additionne %i destinataires une seule fois malgré groupe et attribution directe",
  async (count) => {
    const a = await setup();
    const ids = Array.from({ length: count - 1 }, () => randomUUID());
    await prisma.athlete.createMany({
      data: ids.map((id) => ({ id, organizationId: a.organizationId, firstName: "Test", lastName: "Charge" })),
    });
    await prisma.groupMember.createMany({
      data: ids.map((athleteId) => ({ athleteId, groupId: a.groupId, createdAt: new Date("2020-01-01") })),
    });
    await prisma.assignment.create({
      data: { scheduledSessionId: a.session.id, targetType: "athlete", targetId: a.athlete.athleteId },
    });
    const original = await prisma.sessionPrescription.findFirstOrThrow({ where: { scheduledSessionId: a.session.id } });
    await prisma.sessionPrescription.createMany({
      data: ids.map((athleteId) => ({
        athleteId,
        scheduledSessionId: a.session.id,
        sessionVersion: original.sessionVersion,
        snapshot: original.snapshot!,
        origin: "publication",
      })),
    });
    const data = await getTrainingAnalysis(a.owner.userId, a.organizationId, period);
    expect(data.totals.assignedSessions).toBe(count);
    expect(data.totals.plannedSets).toBe(3 * count);
    expect(data.totals.actual.tonnageKg).toBeNull();
    expect(data.diversity28Days.distinctExercises).toBe(1);
  },
);

it("ne reconstruit pas les anciennes prescriptions avec une séance modifiée", async () => {
  const a = await setup();
  await prisma.sessionPrescription.deleteMany({ where: { scheduledSessionId: a.session.id } });
  const data = await getTrainingAnalysis(a.owner.userId, a.organizationId, period);
  expect(data.totals).toMatchObject({
    assignedSessions: 1,
    frozenSessions: 0,
    plannedItems: 0,
    planned: { tonnageKg: null },
  });
  expect(data.diversity28Days.distinctExercises).toBe(0);
});

it("le contexte ne dévoile pas les phases privées ou les autres cibles à l'athlète et à l'adjoint", async () => {
  const a = await setup();
  await saveTrainingPhase(a.owner.userId, a.organizationId, {
    id: randomUUID(),
    expectedVersion: 0,
    target: { type: "athlete", id: a.athlete.athleteId },
    name: "Phase cachée",
    kind: "development",
    startDate: "2030-06-10",
    endDate: "2030-06-20",
    objective: "",
    description: "",
    privateNote: "Note privée",
  });
  const assistant = await addStaff(a.organizationId, "Adjoint", "assistant", [a.groupId]);
  const mine = await getTrainingAnalysisContext(a.athlete.userId, a.organizationId);
  expect(mine.athletes.map((a) => a.id)).toEqual([a.athlete.athleteId]);
  expect(mine.phases).toEqual([]);
  expect((await getTrainingAnalysisContext(assistant.userId, a.organizationId)).phases).toEqual([]);
  const owner = await getTrainingAnalysisContext(a.owner.userId, a.organizationId);
  expect(owner.phases[0]?.name).toBe("Phase cachée");
  expect(JSON.stringify(owner)).not.toContain("Note privée");
});

it("garde la prescription passée d'un athlète sorti du groupe sans lui réattribuer le futur", async () => {
  const a = await setup();
  await prisma.groupMember.deleteMany({ where: { athleteId: a.athlete.athleteId } });
  const past = await getTrainingAnalysis(
    a.owner.userId,
    a.organizationId,
    { ...period, athleteId: a.athlete.athleteId },
    new Date("2030-07-01T12:00:00Z"),
  );
  expect(past.totals).toMatchObject({ assignedSessions: 1, planned: { tonnageKg: 480 }, actual: { tonnageKg: null } });
  const future = await getTrainingAnalysis(
    a.owner.userId,
    a.organizationId,
    { ...period, athleteId: a.athlete.athleteId },
    new Date("2030-06-01T12:00:00Z"),
  );
  expect(future.totals.assignedSessions).toBe(0);
});
