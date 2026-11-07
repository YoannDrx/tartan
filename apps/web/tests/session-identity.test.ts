import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { sessionDraft, sessionSnapshot, type SaveScheduledSessionInput } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import {
  getSessionForEdit,
  saveScheduledSession,
  publishRow,
  publishSession,
  generateAutonomousVersion,
  moveSession,
} from "@/server/session.service";
import { getSessionBuilderContext } from "@/server/session-builder.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";

const setup = async () => {
  const org = await makeOrg("IdentitesSeance");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Identite");
  const exercises = await prisma.exercise.findMany({ where: { organizationId: org.organizationId }, take: 2 });
  const input: SaveScheduledSessionInput = {
    date: "2030-06-12",
    startTime: null,
    location: null,
    publishAt: null,
    assignments: [{ targetType: "group", targetId: org.groupId }],
    overrides: [{ athleteId: athlete.athleteId, itemRef: "b0-i1", prescription: { reps: 8 } }],
    draft: {
      title: "Ancienne séance",
      type: "strength",
      durationMin: 30,
      coachNote: null,
      blocks: [
        {
          name: "Force",
          variant: "club",
          items: exercises.map((e) => ({ exerciseId: e.id, prescription: { sets: 3, reps: 4 } })),
        },
      ],
    },
  };
  const saved = await saveScheduledSession(org.owner.userId, org.organizationId, input);
  await publishRow(saved.id, org.owner.userId, new Date(), { silent: true });
  const edit = await getSessionForEdit(org.owner.userId, org.organizationId, saved.id);
  return { ...org, athlete, input, saved, edit, exercises };
};

it("conserve les références historiques et l'adaptation après déplacement entre blocs", async () => {
  const a = await setup();
  const draft = structuredClone(a.edit.draft);
  const item = draft.blocks[0]!.items.pop()!;
  draft.blocks.unshift({ ref: randomUUID(), name: "Déplacé", variant: "club", items: [item] });
  await saveScheduledSession(a.owner.userId, a.organizationId, { ...a.edit, draft });
  const saved = await prisma.scheduledSession.findUniqueOrThrow({
    where: { id: a.saved.id },
    include: { overrides: true },
  });
  const snapshot = sessionSnapshot.parse(saved.snapshot);
  expect(snapshot.blocks[0]?.items[0]).toMatchObject({ ref: "b0-i1", exerciseId: a.exercises[1]!.id });
  expect(snapshot.blocks[1]?.items[0]).toMatchObject({ ref: "b0-i0", exerciseId: a.exercises[0]!.id });
  expect(saved.overrides[0]?.itemRef).toBe("b0-i1");
  const reopened = await getSessionForEdit(a.owner.userId, a.organizationId, a.saved.id);
  expect(reopened.draft.blocks[0]?.items[0]?.ref).toBe("b0-i1");
});

it("une seule écriture concurrente réussit, sans écrasement des attributions", async () => {
  const a = await setup();
  const results = await Promise.allSettled(
    ["A", "B"].map((title) =>
      saveScheduledSession(a.owner.userId, a.organizationId, { ...a.edit, draft: { ...a.edit.draft, title } }),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const failure = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
  expect(failure.reason).toMatchObject({ status: 409, code: "session_version_conflict" });
  expect(await prisma.assignment.count({ where: { scheduledSessionId: a.saved.id } })).toBe(1);
  expect((await getSessionForEdit(a.owner.userId, a.organizationId, a.saved.id)).version).toBe(a.edit.version + 1);
});

it("une ancienne application ne peut pas réattribuer les références d'une séance modernisée", async () => {
  const a = await setup();
  await saveScheduledSession(a.owner.userId, a.organizationId, a.edit);
  await expect(
    saveScheduledSession(a.owner.userId, a.organizationId, { ...a.input, id: a.saved.id }),
  ).rejects.toMatchObject({ code: "legacy_session_conflict" });
});

it("refuse de réutiliser l'identité d'un exercice pour un autre, mais accepte un remplacement explicite", async () => {
  const a = await setup();
  const draft = structuredClone(a.edit.draft);
  draft.blocks[0]!.items[0]!.exerciseId = a.exercises[1]!.id;
  await expect(saveScheduledSession(a.owner.userId, a.organizationId, { ...a.edit, draft })).rejects.toMatchObject({
    code: "session_identity_conflict",
  });
  draft.blocks[0]!.items[0]!.ref = randomUUID();
  await expect(saveScheduledSession(a.owner.userId, a.organizationId, { ...a.edit, draft })).resolves.toMatchObject({
    version: a.edit.version + 1,
  });
});

it("refuse les identités en double et les adaptations orphelines avant toute écriture", async () => {
  const a = await setup();
  const draft = structuredClone(a.edit.draft);
  draft.blocks[0]!.items[1]!.ref = draft.blocks[0]!.items[0]!.ref;
  await expect(saveScheduledSession(a.owner.userId, a.organizationId, { ...a.edit, draft })).rejects.toMatchObject({
    status: 400,
  });
  await expect(
    saveScheduledSession(a.owner.userId, a.organizationId, {
      ...a.edit,
      overrides: [{ athleteId: a.athlete.athleteId, itemRef: "inconnu", prescription: {} }],
    }),
  ).rejects.toMatchObject({ status: 400 });
  expect((await getSessionForEdit(a.owner.userId, a.organizationId, a.saved.id)).version).toBe(a.edit.version);
});

it("génère l'autonomie avec de nouvelles identités sans changer celles de la version club", async () => {
  const a = await setup();
  await generateAutonomousVersion(a.owner.userId, a.organizationId, a.saved.id);
  const saved = await prisma.scheduledSession.findUniqueOrThrow({ where: { id: a.saved.id } });
  const draft = sessionDraft.parse(saved.draft);
  expect(draft.blocks[0]?.items[0]?.ref).toBe("b0-i0");
  const refs = draft.blocks.flatMap((b) => b.items.map((i) => i.ref));
  expect(new Set(refs).size).toBe(4);
  expect(saved.version).toBe(a.edit.version + 1);
});

it("déplacer la date invalide un éditeur ouvert ; republier n'incrémente pas à nouveau", async () => {
  const a = await setup();
  await publishRow(a.saved.id, a.owner.userId, new Date(), { silent: true });
  expect((await getSessionForEdit(a.owner.userId, a.organizationId, a.saved.id)).version).toBe(a.edit.version);
  await moveSession(a.owner.userId, a.organizationId, a.saved.id, "2030-06-13");
  await expect(saveScheduledSession(a.owner.userId, a.organizationId, a.edit)).rejects.toMatchObject({
    code: "session_version_conflict",
  });
});

it("le constructeur ne révèle que les destinataires du coach, sans notes privées ni santé", async () => {
  const a = await setup();
  const outside = await prisma.group.create({ data: { organizationId: a.organizationId, name: "Autre groupe" } });
  await addAthlete(a.organizationId, outside.id, "HorsPerimetre");
  const coach = await addStaff(a.organizationId, "CoachLimite", "coach", [a.groupId]);
  const context = await getSessionBuilderContext(coach.userId, a.organizationId);
  expect(context.groups.map((g) => g.id)).toEqual([a.groupId]);
  expect(context.athletes.map((x) => x.id)).toEqual([a.athlete.athleteId]);
  expect(Object.keys(context.athletes[0]!).sort()).toEqual(["firstName", "id", "lastName"]);
  await expect(getSessionBuilderContext(a.athlete.userId, a.organizationId)).rejects.toMatchObject({ status: 403 });
});

it("le coach ne peut ni lire, ni publier, ni réattribuer une séance d'un autre groupe", async () => {
  const a = await setup();
  const otherGroup = await prisma.group.create({ data: { organizationId: a.organizationId, name: "Son groupe" } });
  const coach = await addStaff(a.organizationId, "AutreCoach", "coach", [otherGroup.id]);
  await expect(getSessionForEdit(coach.userId, a.organizationId, a.saved.id)).rejects.toMatchObject({ status: 403 });
  await expect(publishSession(coach.userId, a.organizationId, a.saved.id)).rejects.toMatchObject({ status: 403 });
  await expect(
    saveScheduledSession(coach.userId, a.organizationId, {
      ...a.edit,
      overrides: [],
      assignments: [{ targetType: "group", targetId: otherGroup.id }],
    }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(moveSession(coach.userId, a.organizationId, a.saved.id, "2030-06-14")).rejects.toMatchObject({
    status: 403,
  });
});

it("une référence liée ne peut pas être attribuée à un autre exercice, y compris en adaptation", async () => {
  const a = await setup();
  const draft = structuredClone(a.edit.draft);
  draft.blocks[0]!.items[0]!.prescription.load = { type: "pct_1rm", value: 80, test: `exercise:${a.exercises[1]!.id}` };
  await expect(saveScheduledSession(a.owner.userId, a.organizationId, { ...a.edit, draft })).rejects.toMatchObject({
    status: 400,
  });
  await expect(
    saveScheduledSession(a.owner.userId, a.organizationId, {
      ...a.edit,
      overrides: [
        {
          athleteId: a.athlete.athleteId,
          itemRef: "b0-i0",
          prescription: { load: { type: "pct_1rm", value: 80, test: `exercise:${a.exercises[1]!.id}` } },
        },
      ],
    }),
  ).rejects.toMatchObject({ status: 400 });
});
