import { setTimeout as delay } from "node:timers/promises";
import { expect, it } from "vitest";
import { sessionDraft, sessionSnapshot, type SaveScheduledSessionInput } from "@tartan/contracts";
import { draftFromSession } from "@tartan/domain";
import { prisma } from "@/lib/prisma";
import { getAthleteSession } from "@/server/athlete-view.service";
import { getSessionBuilderContext } from "@/server/session-builder.service";
import {
  getSessionForEdit,
  listTemplates,
  publishRow,
  saveScheduledSession,
  saveTemplate,
  generateAutonomousVersion,
} from "@/server/session.service";
import { addAthlete, makeOrg } from "./helpers";

const setup = async () => {
  const org = await makeOrg("Circuits");
  await prisma.organization.update({ where: { id: org.organizationId }, data: { progressionEnabled: true } });
  const athlete = await addAthlete(org.organizationId, org.groupId, "Circuit");
  const exercises = await prisma.exercise.findMany({
    where: { organizationId: org.organizationId, category: "strength" },
    take: 2,
  });
  const draft = sessionDraft.parse({
    structureVersion: 2,
    title: "Superset",
    type: "strength",
    durationMin: 30,
    coachNote: null,
    blocks: [
      {
        ref: "block",
        name: "Force",
        variant: "club",
        items: exercises.map((e, i) => ({
          ref: `item-${i}`,
          exerciseId: e.id,
          prescription: { sets: 1, reps: 5, load: { type: "kg", value: 40 } },
        })),
        sequence: [
          {
            kind: "repeat",
            ref: "circuit",
            name: "Circuit",
            rounds: 3,
            restBetweenRoundsS: 90,
            children: exercises.map((_, i) => ({ kind: "exercise", itemRef: `item-${i}` })),
          },
        ],
      },
    ],
  });
  const input: SaveScheduledSessionInput = {
    date: "2030-06-12",
    startTime: null,
    location: null,
    publishAt: null,
    draft,
    assignments: [{ targetType: "group", targetId: org.groupId }],
    overrides: [{ athleteId: athlete.athleteId, itemRef: "item-0", prescription: { reps: 7 } }],
  };
  return { ...org, athlete, input, exercises };
};

it("publie A/B par tour, garde les adaptations et ne présente pas les récupérations comme séries réalisées", async () => {
  const a = await setup();
  const saved = await saveScheduledSession(a.owner.userId, a.organizationId, a.input);
  await publishRow(saved.id, a.owner.userId, new Date(), { silent: true });
  const row = await prisma.scheduledSession.findUniqueOrThrow({ where: { id: saved.id } });
  const snapshot = sessionSnapshot.parse(row.snapshot);
  expect(snapshot.structureVersion).toBe(2);
  expect(snapshot.blocks[0]!.items.map((i) => i.sourceRef)).toEqual([
    "item-0",
    "item-1",
    "circuit",
    "item-0",
    "item-1",
    "circuit",
    "item-0",
    "item-1",
  ]);
  const detail = await getAthleteSession(a.athlete.userId, a.organizationId, saved.id);
  expect(detail.blocks[0]!.items.filter((i) => i.sourceRef === "item-0").map((i) => i.prescription.reps)).toEqual([
    7, 7, 7,
  ]);
  expect(draftFromSession(detail).rows).toHaveLength(6);
  expect(new Set(draftFromSession(detail).rows.map((r) => r.itemRef)).size).toBe(6);
});

it("refuse qu'un client aplatisse une séance existante même avec la bonne version", async () => {
  const a = await setup();
  const saved = await saveScheduledSession(a.owner.userId, a.organizationId, a.input);
  const edit = await getSessionForEdit(a.owner.userId, a.organizationId, saved.id);
  const legacy = structuredClone(edit);
  delete legacy.draft.structureVersion;
  for (const block of legacy.draft.blocks) delete block.sequence;
  await expect(saveScheduledSession(a.owner.userId, a.organizationId, legacy)).rejects.toMatchObject({
    status: 409,
    code: "session_structure_upgrade_required",
  });
  expect((await getSessionForEdit(a.owner.userId, a.organizationId, saved.id)).draft).toEqual(edit.draft);
});

it("préserve les modèles et ne les propose pas aux éditeurs qui ne savent pas les conserver", async () => {
  const a = await setup();
  const saved = await saveTemplate(a.owner.userId, a.organizationId, a.input.draft);
  expect((await listTemplates(a.owner.userId, a.organizationId, true)).find((t) => t.id === saved.id)).toMatchObject(
    a.input.draft,
  );
  expect((await listTemplates(a.owner.userId, a.organizationId)).some((t) => t.id === saved.id)).toBe(false);
  expect(
    (await getSessionBuilderContext(a.owner.userId, a.organizationId, true)).templates.some((t) => t.id === saved.id),
  ).toBe(true);
});

it("refuse les références inconnues et les adaptations qui dépassent la capacité de saisie", async () => {
  const a = await setup();
  a.input.draft.blocks[0]!.sequence = [{ kind: "exercise", itemRef: "unknown" }];
  await expect(saveScheduledSession(a.owner.userId, a.organizationId, a.input)).rejects.toMatchObject({ status: 400 });
  const b = await setup();
  const n = b.input.draft.blocks[0]!.sequence![0]!;
  if (n.kind !== "repeat") throw new Error();
  n.rounds = 20;
  b.input.overrides[0]!.prescription.sets = 50;
  await expect(saveScheduledSession(b.owner.userId, b.organizationId, b.input)).rejects.toMatchObject({ status: 400 });
  expect(await prisma.scheduledSession.count({ where: { organizationId: b.organizationId } })).toBe(0);
});

it("génère l'autonomie avec de nouvelles identités de circuit et des liens valides", async () => {
  const a = await setup();
  const saved = await saveScheduledSession(a.owner.userId, a.organizationId, a.input);
  await generateAutonomousVersion(a.owner.userId, a.organizationId, saved.id);
  const edit = await getSessionForEdit(a.owner.userId, a.organizationId, saved.id);
  expect(edit.draft.blocks).toHaveLength(2);
  expect(edit.draft.blocks[1]!.sequence).toHaveLength(1);
  await expect(saveScheduledSession(a.owner.userId, a.organizationId, edit)).resolves.toMatchObject({ id: saved.id });
});

it("révise un circuit après contention sans perdre la prescription précédente", async () => {
  const a = await setup();
  const saved = await saveScheduledSession(a.owner.userId, a.organizationId, a.input);
  await publishRow(saved.id, a.owner.userId, new Date(), { silent: true });
  const edit = await getSessionForEdit(a.owner.userId, a.organizationId, saved.id);
  const before = await prisma.sessionPrescription.findMany({ where: { scheduledSessionId: saved.id } });
  const locked = Promise.withResolvers<number>();
  const release = Promise.withResolvers<void>();
  const blocker = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${a.organizationId}::uuid FOR UPDATE`;
      const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      locked.resolve(connection!.pid);
      await release.promise;
    },
    { timeout: 15000 },
  );
  const pid = await locked.promise;
  const write = saveScheduledSession(a.owner.userId, a.organizationId, {
    ...edit,
    draft: { ...edit.draft, title: "Circuit révisé" },
  }).then(
    (value) => ({ value, error: null }),
    (error: unknown) => ({ value: null, error }),
  );
  try {
    let waiting = false;
    for (let attempt = 0; attempt < 40 && !waiting; attempt++) {
      const [state] = await prisma.$queryRaw<{ waiting: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE ${pid}::int = ANY(pg_blocking_pids(pid))) AS waiting
      `;
      waiting = state!.waiting;
      if (!waiting) await delay(100);
    }
    expect(waiting).toBe(true);
    // Dépasse réellement les cinq secondes de la transaction Prisma par défaut.
    await delay(5500);
  } finally {
    release.resolve();
    await blocker;
  }
  const result = await write;
  if (result.error) throw result.error;
  expect(result.value).toEqual({ id: saved.id, version: edit.version + 1 });
  for (const prescription of before) {
    expect(await prisma.sessionPrescription.findUnique({ where: { id: prescription.id } })).toEqual(prescription);
  }
  const current = await getAthleteSession(a.athlete.userId, a.organizationId, saved.id);
  expect(current.title).toBe("Circuit révisé");
  expect(
    current.blocks[0]!.items.filter((item) => item.sourceRef === "item-0").map((item) => item.prescription.reps),
  ).toEqual([7, 7, 7]);
});
