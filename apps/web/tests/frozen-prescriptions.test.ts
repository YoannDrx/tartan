import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { sessionSnapshot, type SaveScheduledSessionInput } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { getAthleteSession, logSession } from "@/server/athlete-view.service";
import { saveAthlete, deleteStrengthTest } from "@/server/athlete.service";
import { saveExercise } from "@/server/exercise.service";
import { addStrengthTest, selectStrengthReference } from "@/server/strength.service";
import {
  saveScheduledSession,
  publishRow,
  getSessionForEdit,
  moveSession,
  generateAutonomousVersion,
} from "@/server/session.service";
import { addAthlete, makeOrg } from "./helpers";

const setup = async (maximum: number | null = 100) => {
  const org = await makeOrg("Prescription figée");
  await prisma.organization.update({ where: { id: org.organizationId }, data: { progressionEnabled: true } });
  const athlete = await addAthlete(org.organizationId, org.groupId, "Charge");
  const exercise = await saveExercise(org.owner.userId, org.organizationId, {
    name: "Squat vérifié",
    category: "strength",
    strengthLoadKind: "external_total",
  });
  const test =
    maximum === null
      ? null
      : await addStrengthTest(org.owner.userId, org.organizationId, {
          athleteId: athlete.athleteId,
          exerciseId: exercise.id,
          exerciseKey: "ignored",
          value: maximum,
          kind: "one_rm",
          date: "2026-01-01",
          selectAsReference: true,
        });
  const input: SaveScheduledSessionInput = {
    date: "2030-06-12",
    startTime: null,
    location: null,
    publishAt: null,
    assignments: [{ targetType: "group", targetId: org.groupId }],
    overrides: [],
    draft: {
      title: "Force figée",
      type: "strength",
      durationMin: 30,
      coachNote: null,
      blocks: [
        {
          name: "Force",
          variant: "club",
          items: [
            {
              exerciseId: exercise.id,
              prescription: { sets: 3, reps: 4, load: { type: "pct_1rm", value: 80, test: `exercise:${exercise.id}` } },
            },
          ],
        },
      ],
    },
  };
  const session = await saveScheduledSession(org.owner.userId, org.organizationId, input);
  const publish = () => publishRow(session.id, org.owner.userId, new Date(), { silent: true });
  const detail = () => getAthleteSession(athlete.userId, org.organizationId, session.id);
  const reference = (valueKg: number) =>
    selectStrengthReference(org.owner.userId, org.organizationId, athlete.athleteId, exercise.id, {
      source: "working",
      valueKg,
    });
  return { ...org, athlete, exercise, test, session, input, publish, detail, reference };
};

it("fige dès publication sans attendre la première lecture ou validation", async () => {
  const a = await setup();
  await a.publish();
  await a.reference(200);
  await deleteStrengthTest(a.owner.userId, a.organizationId, a.test!.id);
  const detail = await a.detail();
  expect(detail.log).toBeNull();
  expect(detail.blocks[0]?.items[0]?.resolvedLoadKg).toBe(80);
  const row = await prisma.sessionPrescription.findFirstOrThrow({ where: { scheduledSessionId: a.session.id } });
  expect(row).toMatchObject({ sessionVersion: 2, origin: "publication", athleteId: a.athlete.athleteId });
  expect(sessionSnapshot.parse(row.snapshot).blocks[0]?.items[0]?.strengthReference).toMatchObject({
    value: 100,
    sourceTestId: a.test!.id,
  });
});

it("un maximum absent à la publication reste explicitement manquant", async () => {
  const a = await setup(null);
  await a.publish();
  await a.reference(100);
  expect((await a.detail()).blocks[0]?.items[0]?.resolvedLoadKg).toBeNull();
});

it("déplacer une séance ou modifier une consigne conserve la charge, changer le pourcentage crée une nouvelle prescription", async () => {
  const a = await setup();
  await a.publish();
  await a.reference(200);
  await moveSession(a.owner.userId, a.organizationId, a.session.id, "2030-06-13");
  expect((await a.detail()).blocks[0]?.items[0]?.resolvedLoadKg).toBe(80);
  const edit = await getSessionForEdit(a.owner.userId, a.organizationId, a.session.id);
  const draft = structuredClone(edit.draft);
  draft.blocks[0]!.items[0]!.prescription.notes = "Pieds stables";
  await saveScheduledSession(a.owner.userId, a.organizationId, { ...edit, draft });
  expect((await a.detail()).blocks[0]?.items[0]).toMatchObject({
    resolvedLoadKg: 80,
    prescription: { notes: "Pieds stables" },
  });
  const next = await getSessionForEdit(a.owner.userId, a.organizationId, a.session.id);
  next.draft.blocks[0]!.items[0]!.prescription.load = { type: "pct_1rm", value: 70, test: `exercise:${a.exercise.id}` };
  await saveScheduledSession(a.owner.userId, a.organizationId, next);
  expect((await a.detail()).blocks[0]?.items[0]?.resolvedLoadKg).toBe(140);
  const versions = await prisma.sessionPrescription.findMany({
    where: { scheduledSessionId: a.session.id },
    orderBy: { sessionVersion: "asc" },
  });
  expect(versions.map((r) => sessionSnapshot.parse(r.snapshot).blocks[0]?.items[0]?.resolvedLoadKg)).toEqual([
    80, 80, 80, 140,
  ]);
});

it("les adaptations individuelles ne fuient pas dans la prescription d'un autre athlète", async () => {
  const a = await setup();
  const b = await addAthlete(a.organizationId, a.groupId, "Autre");
  await selectStrengthReference(a.owner.userId, a.organizationId, b.athleteId, a.exercise.id, {
    source: "working",
    valueKg: 150,
  });
  const edit = await getSessionForEdit(a.owner.userId, a.organizationId, a.session.id);
  await saveScheduledSession(a.owner.userId, a.organizationId, {
    ...edit,
    overrides: [{ athleteId: b.athleteId, itemRef: "b0-i0", prescription: { load: { type: "kg", value: 60 } } }],
  });
  await a.publish();
  expect((await a.detail()).blocks[0]?.items[0]?.resolvedLoadKg).toBe(80);
  expect((await getAthleteSession(b.userId, a.organizationId, a.session.id)).blocks[0]?.items[0]?.resolvedLoadKg).toBe(
    60,
  );
});

it("l'entrée dans le groupe fige les séances à venir au moment de l'attribution", async () => {
  const a = await setup();
  const b = await addAthlete(a.organizationId, null, "Arrivant");
  await selectStrengthReference(a.owner.userId, a.organizationId, b.athleteId, a.exercise.id, {
    source: "working",
    valueKg: 150,
  });
  await a.publish();
  expect(await prisma.sessionPrescription.count({ where: { athleteId: b.athleteId } })).toBe(0);
  await saveAthlete(a.owner.userId, a.organizationId, {
    id: b.athleteId,
    firstName: "Arrivant",
    lastName: "Test",
    birthDate: "2000-01-01",
    groupIds: [a.groupId],
  });
  await selectStrengthReference(a.owner.userId, a.organizationId, b.athleteId, a.exercise.id, {
    source: "working",
    valueKg: 200,
  });
  expect((await getAthleteSession(b.userId, a.organizationId, a.session.id)).blocks[0]?.items[0]?.resolvedLoadKg).toBe(
    120,
  );
  expect(await prisma.sessionPrescription.findFirst({ where: { athleteId: b.athleteId } })).toMatchObject({
    origin: "assignment",
  });
});

it("la version autonomie préserve les charges club déjà publiées", async () => {
  const a = await setup();
  await a.publish();
  await a.reference(200);
  await generateAutonomousVersion(a.owner.userId, a.organizationId, a.session.id);
  expect((await a.detail()).blocks[0]?.items[0]?.resolvedLoadKg).toBe(80);
});

it("le rejeu de publication n'ajoute pas de version ni de copie", async () => {
  const a = await setup();
  await Promise.all([a.publish(), a.publish()]);
  expect(await prisma.sessionPrescription.count({ where: { scheduledSessionId: a.session.id } })).toBe(1);
  expect((await prisma.scheduledSession.findUniqueOrThrow({ where: { id: a.session.id } })).version).toBe(2);
});

it("l'échec d'écriture de la copie annule la publication entière", async () => {
  const a = await setup();
  await prisma.$executeRawUnsafe(
    "ALTER TABLE session_prescriptions ADD CONSTRAINT simulated_copy_failure CHECK (origin <> 'publication') NOT VALID",
  );
  try {
    await expect(a.publish()).rejects.toBeDefined();
    expect(await prisma.scheduledSession.findUniqueOrThrow({ where: { id: a.session.id } })).toMatchObject({
      publishedAt: null,
      prescriptionFrozenAt: null,
      version: 1,
    });
    expect(await prisma.sessionPrescription.count({ where: { scheduledSessionId: a.session.id } })).toBe(0);
  } finally {
    await prisma.$executeRawUnsafe("ALTER TABLE session_prescriptions DROP CONSTRAINT simulated_copy_failure");
  }
});

it("une validation simple conserve la référence publiée même quand la progression est ensuite désactivée", async () => {
  const a = await setup();
  await a.publish();
  await prisma.organization.update({ where: { id: a.organizationId }, data: { progressionEnabled: false } });
  await logSession(a.athlete.userId, a.organizationId, a.session.id, {
    clientId: randomUUID(),
    status: "done",
    variantDone: "club",
  });
  expect((await a.detail()).blocks[0]?.items[0]?.resolvedLoadKg).toBe(80);
});

it("une validation simple conserve sa version publiée et reste corrigeable par une ancienne application", async () => {
  const a = await setup();
  await a.publish();
  const write = () =>
    logSession(a.athlete.userId, a.organizationId, a.session.id, {
      clientId: randomUUID(),
      status: "done",
      variantDone: "club",
    });
  await write();
  await a.reference(200);
  const edit = await getSessionForEdit(a.owner.userId, a.organizationId, a.session.id);
  edit.draft.blocks[0]!.items[0]!.prescription.load = { type: "kg", value: 90 };
  await saveScheduledSession(a.owner.userId, a.organizationId, edit);
  await write();
  expect((await a.detail()).blocks[0]?.items[0]?.resolvedLoadKg).toBe(80);
  expect(
    (await prisma.sessionLog.findFirstOrThrow({ where: { scheduledSessionId: a.session.id } })).sessionVersion,
  ).toBe(2);
});

it("l'acceptation d'une invitation fige aussi la prescription sans inventer de maximum", async () => {
  const { groupInvitationLink, acceptInvitation } = await import("@/server/invitation.service");
  const { makeUser } = await import("./helpers");
  const a = await setup();
  await a.publish();
  const link = await groupInvitationLink(a.owner.userId, a.organizationId, a.groupId);
  const user = await makeUser("Invité");
  const joined = await acceptInvitation(user, link.link.split("/i/")[1]!, {
    firstName: "Invité",
    lastName: "Test",
    birthDate: "2000-01-01",
    consents: { terms: true, health: false, video: false },
  });
  const row = await prisma.sessionPrescription.findFirstOrThrow({ where: { athleteId: joined.athleteId! } });
  expect(row.origin).toBe("assignment");
  expect(sessionSnapshot.parse(row.snapshot).blocks[0]?.items[0]?.resolvedLoadKg).toBeNull();
});

it("exporte uniquement les copies de l'athlète et les supprime avec sa fiche", async () => {
  const { exportMyData } = await import("@/server/export.service");
  const a = await setup();
  const b = await addAthlete(a.organizationId, a.groupId, "Autre");
  await a.publish();
  const data = await exportMyData(a.athlete.userId);
  expect(data.athletes).toHaveLength(1);
  expect(data.athletes[0]?.prescriptions).toHaveLength(1);
  expect(data.athletes[0]?.strengthReferences[0]?.valueKg.toNumber()).toBe(100);
  expect(JSON.stringify(data)).not.toContain(b.athleteId);
  await prisma.athlete.delete({ where: { id: a.athlete.athleteId } });
  expect(await prisma.sessionPrescription.count({ where: { athleteId: a.athlete.athleteId } })).toBe(0);
  expect(await prisma.sessionPrescription.count({ where: { athleteId: b.athleteId } })).toBe(1);
});

it("individualise une publication pour 120 athlètes sans confondre leurs références", async () => {
  const a = await setup();
  const ids = Array.from({ length: 119 }, () => randomUUID());
  await prisma.athlete.createMany({
    data: ids.map((id, i) => ({ id, organizationId: a.organizationId, firstName: `Groupe${i}`, lastName: "Fictif" })),
  });
  await prisma.groupMember.createMany({ data: ids.map((athleteId) => ({ athleteId, groupId: a.groupId })) });
  await prisma.strengthReference.createMany({
    data: ids.map((athleteId, i) => ({
      organizationId: a.organizationId,
      athleteId,
      exerciseId: a.exercise.id,
      valueKg: 60 + i,
      kind: "working",
      loadKind: "external_total",
    })),
  });
  await a.publish();
  const rows = await prisma.sessionPrescription.findMany({ where: { scheduledSessionId: a.session.id } });
  expect(rows).toHaveLength(120);
  expect(
    sessionSnapshot.parse(rows.find((r) => r.athleteId === ids[0])!.snapshot).blocks[0]?.items[0]?.resolvedLoadKg,
  ).toBe(47.5);
  expect(
    sessionSnapshot.parse(rows.find((r) => r.athleteId === ids[118])!.snapshot).blocks[0]?.items[0]?.resolvedLoadKg,
  ).toBe(142.5);
  expect((await a.detail()).blocks[0]?.items[0]?.resolvedLoadKg).toBe(80);
});

it("la validation rapide du coach conserve la version et invalide une saisie détaillée concurrente", async () => {
  const { coachLogSession } = await import("@/server/tracking.service");
  const { getAthleteSessionForCoach, logSessionForAthlete } = await import("@/server/athlete-view.service");
  const a = await setup();
  await prisma.athlete.update({ where: { id: a.athlete.athleteId }, data: { userId: null } });
  await a.publish();
  await coachLogSession(a.owner.userId, a.organizationId, a.session.id, a.athlete.athleteId, "done");
  const edit = await getSessionForEdit(a.owner.userId, a.organizationId, a.session.id);
  edit.draft.blocks[0]!.items[0]!.prescription.load = { type: "kg", value: 90 };
  await saveScheduledSession(a.owner.userId, a.organizationId, edit);
  await coachLogSession(a.owner.userId, a.organizationId, a.session.id, a.athlete.athleteId, "partial");
  const detail = await getAthleteSessionForCoach(a.owner.userId, a.organizationId, a.session.id, a.athlete.athleteId);
  expect(detail.blocks[0]?.items[0]?.resolvedLoadKg).toBe(80);
  expect(detail.log?.version).toBe(2);
  await expect(
    logSessionForAthlete(a.owner.userId, a.organizationId, a.session.id, a.athlete.athleteId, {
      clientId: randomUUID(),
      status: "done",
      variantDone: "club",
      detailedSets: [],
      expectedVersion: 1,
      expectedSessionVersion: 3,
    }),
  ).rejects.toMatchObject({ code: "log_version_conflict" });
});

it("les copies créées par une publication automatique ne prolongent pas la conservation de l'espace", async () => {
  const a = await setup();
  const before = new Date("2025-01-01T00:00:00Z");
  await prisma.organization.update({ where: { id: a.organizationId }, data: { lastBusinessActivityAt: before } });
  await a.publish();
  expect(
    (await prisma.organization.findUniqueOrThrow({ where: { id: a.organizationId } })).lastBusinessActivityAt,
  ).toEqual(before);
});
