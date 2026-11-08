import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import type { SaveScheduledSessionInput, SaveTrainingPhaseInput } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { getTrainingAnalysis, getTrainingAnalysisContext } from "@/server/training-analysis.service";
import { getPhasePlanning, saveTrainingPhase, setTrainingPhaseVisibility } from "@/server/training-phases.service";
import { getSessionForEdit, publishRow, saveScheduledSession } from "@/server/session.service";
import { getAthleteSession, logSession } from "@/server/athlete-view.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";

const period = { from: "2030-06-01", to: "2030-06-28" };
async function setup() {
  const org = await makeOrg("AnalysePhase");
  await prisma.organization.update({
    where: { id: org.organizationId },
    data: { phasesEnabled: true, progressionEnabled: true },
  });
  const a = await addAthlete(org.organizationId, org.groupId, "Ada");
  const b = await addAthlete(org.organizationId, org.groupId, "Bea");
  const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: org.organizationId } });
  await prisma.exercise.update({ where: { id: exercise.id }, data: { strengthLoadKind: "external_total" } });
  const phase: SaveTrainingPhaseInput = {
    id: randomUUID(),
    expectedVersion: 0,
    name: "Développement",
    target: { type: "group", id: org.groupId },
    kind: "development",
    startDate: period.from,
    endDate: period.to,
    objective: "",
    description: "",
    privateNote: "SECRET_NOTE_PHASE",
  };
  await saveTrainingPhase(org.owner.userId, org.organizationId, phase);
  await setTrainingPhaseVisibility(org.owner.userId, org.organizationId, phase.id, {
    expectedVersion: 1,
    shared: true,
  });
  const input: SaveScheduledSessionInput = {
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
      coachNote: null,
      blocks: [
        {
          name: "Force",
          variant: "club",
          items: [{ exerciseId: exercise.id, prescription: { sets: 3, reps: 4, load: { type: "kg", value: 40 } } }],
        },
      ],
    },
  };
  const session = await saveScheduledSession(org.owner.userId, org.organizationId, input);
  await publishRow(session.id, org.owner.userId, new Date(), { silent: true });
  const analysis = () => getTrainingAnalysis(org.owner.userId, org.organizationId, { ...period, phaseId: phase.id });
  return { ...org, a, b, phase, input, session, analysis };
}

it("une correction des dates ne déplace pas les prescriptions historiques et élargit la fenêtre de consultation coach", async () => {
  const a = await setup();
  expect((await a.analysis()).totals).toMatchObject({ assignedSessions: 2, planned: { tonnageKg: 960 } });
  await saveTrainingPhase(a.owner.userId, a.organizationId, {
    ...a.phase,
    expectedVersion: 2,
    startDate: "2030-07-01",
    endDate: "2030-07-28",
  });
  expect((await a.analysis()).totals).toMatchObject({ assignedSessions: 2, planned: { tonnageKg: 960 } });
  const coachContext = await getTrainingAnalysisContext(a.owner.userId, a.organizationId);
  expect(coachContext.phases.find((p) => p.id === a.phase.id)).toMatchObject({
    startDate: "2030-06-12",
    endDate: "2030-07-28",
  });
  const publicContext = await getTrainingAnalysisContext(a.a.userId, a.organizationId);
  expect(publicContext.phases.find((p) => p.id === a.phase.id)).toMatchObject({
    startDate: "2030-07-01",
    endDate: "2030-07-28",
  });
});

it("utilise la phase de la version réalisée quand une prescription plus récente existe", async () => {
  const a = await setup();
  const detail = await getAthleteSession(a.a.userId, a.organizationId, a.session.id);
  await logSession(a.a.userId, a.organizationId, a.session.id, {
    clientId: randomUUID(),
    expectedVersion: 0,
    expectedSessionVersion: detail.sessionVersion,
    status: "partial",
    variantDone: "club",
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
  await saveTrainingPhase(a.owner.userId, a.organizationId, {
    ...a.phase,
    expectedVersion: 2,
    startDate: "2030-07-01",
    endDate: "2030-07-28",
  });
  const other = await saveTrainingPhase(a.owner.userId, a.organizationId, {
    ...a.phase,
    id: randomUUID(),
    name: "Nouvelle phase",
  });
  const edit = await getSessionForEdit(a.owner.userId, a.organizationId, a.session.id);
  const review = await getPhasePlanning(a.owner.userId, a.organizationId, {
    date: edit.date,
    groupIds: [a.groupId],
    athleteIds: [],
    choices: [],
  });
  await saveScheduledSession(a.owner.userId, a.organizationId, {
    ...edit,
    phaseReview: { token: review.token, choices: [] },
  });
  const old = await a.analysis();
  expect(old.phase?.coverage).toEqual({ matched: 1, withoutReference: 0, otherPhase: 1 });
  expect(old.totals).toMatchObject({ assignedSessions: 1, planned: { tonnageKg: 480 }, actual: { tonnageKg: 320 } });
  const next = await getTrainingAnalysis(a.owner.userId, a.organizationId, { ...period, phaseId: other.id });
  expect(next.totals).toMatchObject({ assignedSessions: 1, planned: { tonnageKg: 480 }, actual: { tonnageKg: null } });
  // An imported legacy validation without a known version must not inherit the latest phase.
  await prisma.sessionLog.updateMany({ where: { scheduledSessionId: a.session.id }, data: { sessionVersion: null } });
  expect((await a.analysis()).phase?.coverage).toEqual({ matched: 0, withoutReference: 1, otherPhase: 1 });
});

it("ne laisse pas une priorité individuelle privée influencer les statistiques publiques", async () => {
  const a = await setup();
  const query = { ...period, phaseId: a.phase.id };
  const before = await getTrainingAnalysis(a.a.userId, a.organizationId, query);
  const personal = await saveTrainingPhase(a.owner.userId, a.organizationId, {
    ...a.phase,
    id: randomUUID(),
    target: { type: "athlete", id: a.a.athleteId },
    name: "PRIVE_INVISIBLE",
  });
  const edit = await getSessionForEdit(a.owner.userId, a.organizationId, a.session.id);
  const review = await getPhasePlanning(a.owner.userId, a.organizationId, {
    date: edit.date,
    groupIds: [a.groupId],
    athleteIds: [],
    choices: [],
  });
  await saveScheduledSession(a.owner.userId, a.organizationId, {
    ...edit,
    phaseReview: { token: review.token, choices: [] },
  });
  const spy = vi.spyOn(prisma, "$queryRaw");
  try {
    const after = await getTrainingAnalysis(a.a.userId, a.organizationId, query);
    expect(after).toEqual(before);
    expect(after.phase).toMatchObject({ basis: "shared_period" });
    expect(after.phase?.coverage).toBeUndefined();
    expect(JSON.stringify(after)).not.toContain(personal.id);
    expect(spy).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
  expect((await a.analysis()).phase?.coverage).toEqual({ matched: 1, withoutReference: 0, otherPhase: 1 });
  await expect(
    getTrainingAnalysis(a.a.userId, a.organizationId, { ...period, phaseId: personal.id }),
  ).rejects.toMatchObject({ status: 404 });
});

it("conserve les références passées après sortie de groupe et refuse les phases hors périmètre", async () => {
  const a = await setup();
  await prisma.groupMember.delete({ where: { groupId_athleteId: { groupId: a.groupId, athleteId: a.a.athleteId } } });
  const data = await getTrainingAnalysis(
    a.owner.userId,
    a.organizationId,
    { ...period, phaseId: a.phase.id },
    new Date("2030-08-01"),
  );
  expect(data.totals.assignedSessions).toBe(2);
  const other = await prisma.group.create({ data: { organizationId: a.organizationId, name: "Autre" } });
  const coach = await addStaff(a.organizationId, "CoachRestreint", "coach", [other.id]);
  await expect(
    getTrainingAnalysis(coach.userId, a.organizationId, { ...period, phaseId: a.phase.id }),
  ).rejects.toMatchObject({ status: 403 });
  const foreign = await makeOrg("AutreEspacePhase");
  await expect(
    getTrainingAnalysis(foreign.owner.userId, a.organizationId, { ...period, phaseId: a.phase.id }),
  ).rejects.toMatchObject({ status: 403 });
});

it("un statut manqué automatique conserve la phase du prévu sans inventer une réponse", async () => {
  const a = await setup();
  await prisma.sessionLog.create({
    data: { athleteId: a.a.athleteId, scheduledSessionId: a.session.id, status: "missed" },
  });
  const data = await a.analysis();
  expect(data.phase?.coverage).toEqual({ matched: 2, withoutReference: 0, otherPhase: 0 });
  expect(data.totals).toMatchObject({
    assignedSessions: 2,
    loggedSessions: 0,
    planned: { tonnageKg: 960 },
    actual: { tonnageKg: null },
  });
});
