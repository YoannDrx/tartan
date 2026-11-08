import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import type { SaveScheduledSessionInput, SaveTrainingPhaseInput } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { getAthleteSession } from "@/server/athlete-view.service";
import {
  getSessionForEdit,
  moveSession,
  publishRow,
  publishSession,
  saveScheduledSession,
} from "@/server/session.service";
import { getPhasePlanning, saveTrainingPhase } from "@/server/training-phases.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";

async function setup() {
  const org = await makeOrg("PhaseConservee");
  await prisma.organization.update({
    where: { id: org.organizationId },
    data: { progressionEnabled: true, phasesEnabled: true },
  });
  const athlete = await addAthlete(org.organizationId, org.groupId, "Phase");
  const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: org.organizationId } });
  const phase: SaveTrainingPhaseInput = {
    id: randomUUID(),
    expectedVersion: 0,
    target: { type: "group", id: org.groupId },
    name: "Phase privée",
    kind: "development",
    startDate: "2030-06-01",
    endDate: "2030-06-30",
    objective: "Force",
    description: "",
    privateNote: "NOTE_STRICTEMENT_PRIVEE",
  };
  await saveTrainingPhase(org.owner.userId, org.organizationId, phase);
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
      durationMin: 30,
      coachNote: null,
      blocks: [
        { name: "Force", variant: "club", items: [{ exerciseId: exercise.id, prescription: { sets: 3, reps: 4 } }] },
      ],
    },
  };
  const review = async (choices: { athleteId: string; groupId: string }[] = []) => {
    const result = await getPhasePlanning(org.owner.userId, org.organizationId, {
      date: input.date,
      groupIds: [org.groupId],
      athleteIds: [],
      choices,
    });
    return { token: result.token, choices };
  };
  const copy = (id: string) =>
    prisma.sessionPrescription.findMany({ where: { scheduledSessionId: id }, orderBy: { sessionVersion: "asc" } });
  return { ...org, athlete, phase, input, review, copy };
}

it("conserve le contexte choisi à la réouverture et fige sa version sans révéler la phase privée à l'athlète", async () => {
  const a = await setup();
  const review = await a.review();
  const saved = await saveScheduledSession(a.owner.userId, a.organizationId, { ...a.input, phaseReview: review });
  expect((await getSessionForEdit(a.owner.userId, a.organizationId, saved.id)).phaseReview).toEqual(review);
  await publishRow(saved.id, a.owner.userId, new Date(), { silent: true });
  expect(await a.copy(saved.id)).toMatchObject([
    { athleteId: a.athlete.athleteId, phaseId: a.phase.id, phaseVersion: 1 },
  ]);
  const detail = JSON.stringify(await getAthleteSession(a.athlete.userId, a.organizationId, saved.id));
  expect(detail).not.toContain(a.phase.id);
  expect(detail).not.toContain("phaseContext");
  expect(detail).not.toContain(a.phase.privateNote);
  await saveTrainingPhase(a.owner.userId, a.organizationId, {
    ...a.phase,
    expectedVersion: 1,
    name: "Autre nom",
    startDate: "2030-07-01",
    endDate: "2030-07-31",
  });
  expect(await a.copy(saved.id)).toMatchObject([{ phaseId: a.phase.id, phaseVersion: 1 }]);
  // A replay does not rewrite a prescription after the phase changes.
  await publishRow(saved.id, a.owner.userId, new Date(), { silent: true });
  expect(await a.copy(saved.id)).toHaveLength(1);
});

it("refuse un contexte devenu obsolète avant écriture et avant publication, puis accepte une nouvelle revue", async () => {
  const a = await setup();
  const stale = await a.review();
  const saved = await saveScheduledSession(a.owner.userId, a.organizationId, { ...a.input, phaseReview: stale });
  await saveTrainingPhase(a.owner.userId, a.organizationId, { ...a.phase, expectedVersion: 1, objective: "Puissance" });
  await expect(
    saveScheduledSession(a.owner.userId, a.organizationId, { ...a.input, phaseReview: stale }),
  ).rejects.toMatchObject({ code: "phase_context_conflict" });
  await expect(publishRow(saved.id, a.owner.userId, new Date(), { silent: true })).rejects.toMatchObject({
    code: "phase_context_conflict",
  });
  expect(await a.copy(saved.id)).toHaveLength(0);
  expect((await prisma.scheduledSession.findUniqueOrThrow({ where: { id: saved.id } })).publishedAt).toBeNull();
  const edit = await getSessionForEdit(a.owner.userId, a.organizationId, saved.id);
  // Drafting remains possible without revalidating an unavailable preview.
  await saveScheduledSession(a.owner.userId, a.organizationId, { ...edit, phaseReview: undefined });
  const current = await getSessionForEdit(a.owner.userId, a.organizationId, saved.id);
  await saveScheduledSession(a.owner.userId, a.organizationId, { ...current, phaseReview: await a.review() });
  await publishRow(saved.id, a.owner.userId, new Date(), { silent: true });
  expect(await a.copy(saved.id)).toMatchObject([{ phaseId: a.phase.id, phaseVersion: 2 }]);
});

it("exige et conserve le choix multi-groupes, même pour un ancien client qui ne fournit pas de revue", async () => {
  const a = await setup();
  const group = await prisma.group.create({ data: { organizationId: a.organizationId, name: "Vitesse" } });
  await prisma.groupMember.create({
    data: { groupId: group.id, athleteId: a.athlete.athleteId, createdAt: new Date("2020-01-01") },
  });
  const second = { ...a.phase, id: randomUUID(), target: { type: "group" as const, id: group.id }, name: "Vitesse" };
  await saveTrainingPhase(a.owner.userId, a.organizationId, second);
  const saved = await saveScheduledSession(a.owner.userId, a.organizationId, a.input);
  await expect(publishRow(saved.id, a.owner.userId, new Date(), { silent: true })).rejects.toMatchObject({
    code: "phase_choice_required",
  });
  await expect(
    saveScheduledSession(a.owner.userId, a.organizationId, { ...a.input, publishAt: "2030-06-01T10:00:00Z" }),
  ).rejects.toMatchObject({ code: "phase_choice_required" });
  const review = await a.review([{ athleteId: a.athlete.athleteId, groupId: group.id }]);
  await saveScheduledSession(a.owner.userId, a.organizationId, {
    ...(await getSessionForEdit(a.owner.userId, a.organizationId, saved.id)),
    phaseReview: review,
  });
  await publishRow(saved.id, a.owner.userId, new Date(), { silent: true });
  expect(await a.copy(saved.id)).toMatchObject([{ phaseId: second.id, phaseVersion: 1 }]);
  expect((await getSessionForEdit(a.owner.userId, a.organizationId, saved.id)).phaseReview).toEqual(review);
});

it("une arrivée après la revue exige une actualisation de l'audience avant publication", async () => {
  const a = await setup();
  const saved = await saveScheduledSession(a.owner.userId, a.organizationId, {
    ...a.input,
    phaseReview: await a.review(),
  });
  await addAthlete(a.organizationId, a.groupId, "Arrivee");
  await expect(publishRow(saved.id, a.owner.userId, new Date(), { silent: true })).rejects.toMatchObject({
    code: "phase_context_conflict",
  });
  expect(await a.copy(saved.id)).toHaveLength(0);
});

it("ne renvoie pas le choix d'un athlète qui a quitté le périmètre du coach", async () => {
  const a = await setup();
  const coach = await addStaff(a.organizationId, "Perimetre", "coach", [a.groupId]);
  const phaseReview = await a.review([{ athleteId: a.athlete.athleteId, groupId: a.groupId }]);
  const saved = await saveScheduledSession(coach.userId, a.organizationId, { ...a.input, phaseReview });
  await prisma.groupMember.delete({
    where: { groupId_athleteId: { groupId: a.groupId, athleteId: a.athlete.athleteId } },
  });
  const current = await getSessionForEdit(coach.userId, a.organizationId, saved.id);
  expect(current.phaseReview).toBeUndefined();
});

it("un déplacement hors phase crée une nouvelle copie sans réattribuer les anciennes", async () => {
  const a = await setup();
  const saved = await saveScheduledSession(a.owner.userId, a.organizationId, a.input);
  await publishRow(saved.id, a.owner.userId, new Date(), { silent: true });
  await moveSession(a.owner.userId, a.organizationId, saved.id, "2030-07-12");
  expect(await a.copy(saved.id)).toMatchObject([
    { phaseId: a.phase.id, phaseVersion: 1 },
    { phaseId: null, phaseVersion: null },
  ]);
});

it("le drapeau désactivé laisse les séances manuelles utilisables sans inventer de référence", async () => {
  const a = await setup();
  await prisma.organization.update({ where: { id: a.organizationId }, data: { phasesEnabled: false } });
  const saved = await saveScheduledSession(a.owner.userId, a.organizationId, a.input);
  await publishRow(saved.id, a.owner.userId, new Date(), { silent: true });
  expect(await a.copy(saved.id)).toMatchObject([{ phaseId: null, phaseVersion: null }]);
});

it("revérifie l'auteur programmé révoqué, mais autorise le propriétaire actuel à publier", async () => {
  const a = await setup();
  const coach = await addStaff(a.organizationId, "Auteur", "coach", [a.groupId]);
  const saved = await saveScheduledSession(coach.userId, a.organizationId, a.input);
  await prisma.organizationMember.delete({
    where: { organizationId_userId: { organizationId: a.organizationId, userId: coach.userId } },
  });
  await expect(publishRow(saved.id, coach.userId, new Date(), { silent: true })).rejects.toMatchObject({ status: 403 });
  await publishSession(a.owner.userId, a.organizationId, saved.id);
  expect(await a.copy(saved.id)).toHaveLength(1);
});

it("la base interdit une référence de phase sans version et une version sans référence", async () => {
  const a = await setup();
  const saved = await saveScheduledSession(a.owner.userId, a.organizationId, a.input);
  await publishRow(saved.id, a.owner.userId, new Date(), { silent: true });
  const [copy] = await a.copy(saved.id);
  await expect(
    prisma.sessionPrescription.update({ where: { id: copy!.id }, data: { phaseVersion: null } }),
  ).rejects.toThrow();
  await expect(
    prisma.sessionPrescription.update({ where: { id: copy!.id }, data: { phaseId: null } }),
  ).rejects.toThrow();
});
