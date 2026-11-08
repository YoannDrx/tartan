import { listSpaces } from "@/server/me.service";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { resolveLoadKg } from "@tartan/domain";
import { prisma } from "@/lib/prisma";
import { saveExercise } from "@/server/exercise.service";
import { deleteStrengthTest } from "@/server/athlete.service";
import {
  addStrengthTest,
  confirmStrengthMapping,
  getExerciseStrength,
  selectStrengthReference,
  strengthMappingReport,
  strengthResolutionInputs,
} from "@/server/strength.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";

const setup = async () => {
  const org = await makeOrg("References");
  await prisma.organization.update({ where: { id: org.organizationId }, data: { progressionEnabled: true } });
  const athlete = await addAthlete(org.organizationId, org.groupId, "Force");
  const exercise = await saveExercise(org.owner.userId, org.organizationId, {
    name: "Squat arrière",
    category: "strength",
    strengthLoadKind: "external_total",
    loadStepKg: 2.5,
  });
  const add = (value: number, selectAsReference = false) =>
    addStrengthTest(org.owner.userId, org.organizationId, {
      athleteId: athlete.athleteId,
      exerciseId: exercise.id,
      exerciseKey: "ignored",
      kind: "one_rm",
      value,
      date: "2030-06-01",
      selectAsReference,
    });
  return { ...org, athlete, exercise, add };
};

it("un test supplémentaire ne remplace pas la référence choisie ; le pas vient de l'exercice", async () => {
  const a = await setup();
  await a.add(100);
  expect(
    (await getExerciseStrength(a.owner.userId, a.organizationId, a.athlete.athleteId, a.exercise.id)).reference,
  ).toBeNull();
  const selected = await a.add(110, true);
  await a.add(130);
  const result = await getExerciseStrength(a.owner.userId, a.organizationId, a.athlete.athleteId, a.exercise.id);
  expect(result.reference).toMatchObject({ valueKg: 110, kind: "tested", sourceTestId: selected.id });
  expect(result.tests).toHaveLength(3);
  expect(
    resolveLoadKg(
      { load: { type: "pct_1rm", value: 80, test: `exercise:${a.exercise.id}` } },
      await strengthResolutionInputs(prisma, a.athlete.athleteId),
    ),
  ).toBe(87.5);
  await selectStrengthReference(a.owner.userId, a.organizationId, a.athlete.athleteId, a.exercise.id, {
    source: "working",
    valueKg: 90,
  });
  await a.add(150);
  expect(
    (await getExerciseStrength(a.owner.userId, a.organizationId, a.athlete.athleteId, a.exercise.id)).reference,
  ).toMatchObject({ valueKg: 90, kind: "working", sourceTestId: null });
});

it("le rattachement est explicite, idempotent, audité et les anciennes clés restent conservées", async () => {
  const a = await setup();
  const old = await addStrengthTest(a.owner.userId, a.organizationId, {
    athleteId: a.athlete.athleteId,
    exerciseKey: "back_squat",
    kind: "three_rm",
    value: 100,
    date: "2030-05-01",
  });
  expect((await prisma.strengthTest.findUniqueOrThrow({ where: { id: old.id } })).exerciseId).toBeNull();
  expect((await strengthMappingReport(a.owner.userId, a.organizationId)).unmapped).toContainEqual({
    legacyKey: "back_squat",
    count: 1,
  });
  const mapping = {
    legacyKey: "back_squat",
    exerciseId: a.exercise.id,
    reason: "Correspondance confirmée avec le coach",
    confirmed: true,
  };
  await confirmStrengthMapping(a.owner.userId, a.organizationId, mapping);
  const report = await confirmStrengthMapping(a.owner.userId, a.organizationId, mapping);
  expect(report.mappings).toEqual([
    {
      legacyKey: "back_squat",
      exerciseId: a.exercise.id,
      reason: mapping.reason,
      exerciseName: "Squat arrière",
      loadKind: "external_total",
    },
  ]);
  expect(await prisma.strengthTest.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({
    exerciseId: a.exercise.id,
    exerciseKey: "back_squat",
    loadKind: "external_total",
  });
  expect(
    await prisma.auditLog.count({ where: { organizationId: a.organizationId, action: "strength_mapping_confirmed" } }),
  ).toBe(1);
  const pct = { load: { type: "pct_1rm" as const, value: 80, test: "back_squat" } };
  expect(resolveLoadKg(pct, await strengthResolutionInputs(prisma, a.athlete.athleteId))).toBeNull();
  const reference = await selectStrengthReference(
    a.owner.userId,
    a.organizationId,
    a.athlete.athleteId,
    a.exercise.id,
    { source: "test", testId: old.id },
  );
  expect(reference.reference).toMatchObject({ kind: "estimated", valueKg: 110 });
  expect(resolveLoadKg(pct, await strengthResolutionInputs(prisma, a.athlete.athleteId))).toBe(87.5);
  const futureLegacy = await addStrengthTest(a.owner.userId, a.organizationId, {
    athleteId: a.athlete.athleteId,
    exerciseKey: "back_squat",
    kind: "one_rm",
    value: 140,
    date: "2030-06-01",
  });
  expect((await prisma.strengthTest.findUniqueOrThrow({ where: { id: futureLegacy.id } })).exerciseId).toBe(
    a.exercise.id,
  );
  expect(resolveLoadKg(pct, await strengthResolutionInputs(prisma, a.athlete.athleteId))).toBe(87.5);
});

it("supprimer le test source retire la référence, sans choisir silencieusement un autre test", async () => {
  const a = await setup();
  const source = await a.add(100, true);
  await a.add(120);
  await deleteStrengthTest(a.owner.userId, a.organizationId, source.id);
  const result = await getExerciseStrength(a.owner.userId, a.organizationId, a.athlete.athleteId, a.exercise.id);
  expect(result.reference).toBeNull();
  expect(result.tests).toHaveLength(1);
});

it("ne confond pas assistance, charge additionnelle et charge externe, et verrouille les conventions utilisées", async () => {
  const a = await setup();
  await a.add(100);
  await expect(
    saveExercise(a.owner.userId, a.organizationId, {
      id: a.exercise.id,
      name: "Squat arrière",
      category: "strength",
      strengthLoadKind: "added_weight",
    }),
  ).rejects.toMatchObject({ code: "exercise_convention_locked" });
  const assisted = await saveExercise(a.owner.userId, a.organizationId, {
    name: "Tractions assistées",
    category: "strength",
    strengthLoadKind: "assistance",
  });
  await expect(
    addStrengthTest(a.owner.userId, a.organizationId, {
      athleteId: a.athlete.athleteId,
      exerciseId: assisted.id,
      exerciseKey: "pull_up",
      kind: "one_rm",
      value: 40,
      date: "2030-06-01",
    }),
  ).rejects.toMatchObject({ status: 400 });
  await saveExercise(a.owner.userId, a.organizationId, {
    id: a.exercise.id,
    name: "Squat renommé",
    category: "strength",
  });
  expect((await prisma.exercise.findUniqueOrThrow({ where: { id: a.exercise.id } })).strengthLoadKind).toBe(
    "external_total",
  );
});

it("refuse les références d'un autre athlète, exercice ou espace et les écritures athlètes", async () => {
  const a = await setup();
  const b = await setup();
  const source = await b.add(100);
  await expect(
    selectStrengthReference(a.owner.userId, a.organizationId, a.athlete.athleteId, a.exercise.id, {
      source: "test",
      testId: source.id,
    }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    selectStrengthReference(a.athlete.userId, a.organizationId, a.athlete.athleteId, a.exercise.id, {
      source: "working",
      valueKg: 100,
    }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    getExerciseStrength(a.athlete.userId, a.organizationId, b.athlete.athleteId, a.exercise.id),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    getExerciseStrength(a.owner.userId, a.organizationId, a.athlete.athleteId, b.exercise.id),
  ).rejects.toMatchObject({ status: 404 });
  const coach = await addStaff(a.organizationId, "HorsGroupe", "coach");
  await expect(
    selectStrengthReference(coach.userId, a.organizationId, a.athlete.athleteId, a.exercise.id, {
      source: "working",
      valueKg: 100,
    }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    confirmStrengthMapping(coach.userId, a.organizationId, {
      legacyKey: "back_squat",
      exerciseId: a.exercise.id,
      confirmed: true,
      reason: "Correspondance confirmée",
    }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    getExerciseStrength(a.owner.userId, a.organizationId, a.athlete.athleteId, randomUUID()),
  ).rejects.toMatchObject({ status: 404 });
});

it("le drapeau bloque les nouvelles écritures sans supprimer la compatibilité des anciens tests", async () => {
  const a = await setup();
  await prisma.organization.update({ where: { id: a.organizationId }, data: { progressionEnabled: false } });
  await expect(a.add(100, true)).rejects.toMatchObject({ code: "progression_disabled" });
  await expect(
    selectStrengthReference(a.owner.userId, a.organizationId, a.athlete.athleteId, a.exercise.id, {
      source: "working",
      valueKg: 80,
    }),
  ).rejects.toMatchObject({ code: "progression_disabled" });
  await expect(
    confirmStrengthMapping(a.owner.userId, a.organizationId, {
      legacyKey: "back_squat",
      exerciseId: a.exercise.id,
      confirmed: true,
      reason: "Correspondance vérifiée",
    }),
  ).rejects.toMatchObject({ code: "progression_disabled" });
  await expect(
    addStrengthTest(a.owner.userId, a.organizationId, {
      athleteId: a.athlete.athleteId,
      exerciseKey: "back_squat",
      kind: "one_rm",
      value: 100,
      date: "2030-06-01",
    }),
  ).resolves.toHaveProperty("id");
  expect(await prisma.strengthReference.count({ where: { organizationId: a.organizationId } })).toBe(0);
});

it("deux rapprochements concurrents ne peuvent pas attribuer une même clé à deux variantes", async () => {
  const a = await setup();
  const other = await saveExercise(a.owner.userId, a.organizationId, {
    name: "Squat machine",
    category: "strength",
    strengthLoadKind: "external_total",
  });
  const results = await Promise.allSettled(
    [a.exercise.id, other.id].map((exerciseId) =>
      confirmStrengthMapping(a.owner.userId, a.organizationId, {
        legacyKey: "back_squat",
        exerciseId,
        confirmed: true,
        reason: "Correspondance vérifiée",
      }),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({
    code: "strength_mapping_conflict",
  });
  expect(await prisma.legacyStrengthMapping.count({ where: { organizationId: a.organizationId } })).toBe(1);
});

it("une réalisation détaillée conserve sa référence après sélection, correction puis suppression du test source", async () => {
  const { saveScheduledSession, publishRow } = await import("@/server/session.service");
  const { logSession, getAthleteSession } = await import("@/server/athlete-view.service");
  const a = await setup();
  const source = await a.add(100, true);
  const session = await saveScheduledSession(a.owner.userId, a.organizationId, {
    date: "2030-06-12",
    startTime: null,
    location: null,
    publishAt: null,
    assignments: [{ targetType: "group", targetId: a.groupId }],
    overrides: [],
    draft: {
      title: "Référence conservée",
      type: "strength",
      durationMin: 30,
      coachNote: null,
      blocks: [
        {
          name: "Force",
          variant: "club",
          items: [
            {
              exerciseId: a.exercise.id,
              prescription: {
                sets: 3,
                reps: 4,
                load: { type: "pct_1rm", value: 80, test: `exercise:${a.exercise.id}` },
              },
            },
          ],
        },
      ],
    },
  });
  await publishRow(session.id, a.owner.userId, new Date(), { silent: true });
  const write = (expectedVersion: number, loadKg: number) =>
    logSession(a.athlete.userId, a.organizationId, session.id, {
      clientId: randomUUID(),
      status: "done",
      variantDone: "club",
      expectedVersion,
      expectedSessionVersion: 2,
      detailedSets: [
        {
          itemRef: "b0-i0",
          setIndex: 0,
          reps: 4,
          loadKg,
          done: true,
          setKind: "work",
          loadKind: "external",
          repetitionScope: "total",
          sideCount: 1,
        },
      ],
    });
  await write(0, 80);
  const before = (await prisma.sessionLog.findFirstOrThrow({ where: { scheduledSessionId: session.id } }))
    .prescriptionSnapshot;
  await selectStrengthReference(a.owner.userId, a.organizationId, a.athlete.athleteId, a.exercise.id, {
    source: "working",
    valueKg: 150,
  });
  await deleteStrengthTest(a.owner.userId, a.organizationId, source.id);
  await write(1, 75);
  expect(
    (await prisma.sessionLog.findFirstOrThrow({ where: { scheduledSessionId: session.id } })).prescriptionSnapshot,
  ).toEqual(before);
  const detail = await getAthleteSession(a.athlete.userId, a.organizationId, session.id);
  expect(detail.blocks[0]?.items[0]?.resolvedLoadKg).toBe(80);
  expect(detail.log?.detailedSets?.[0]?.loadKg).toBe(75);
});

it("refuse une précision que le stockage en centièmes de kilogramme ne peut pas conserver", async () => {
  const a = await setup();
  await expect(a.add(0.001, true)).rejects.toHaveProperty("name", "ZodError");
  await expect(
    selectStrengthReference(a.owner.userId, a.organizationId, a.athlete.athleteId, a.exercise.id, {
      source: "working",
      valueKg: 75.125,
    }),
  ).rejects.toHaveProperty("name", "ZodError");
  expect(await prisma.strengthTest.count({ where: { athleteId: a.athlete.athleteId } })).toBe(0);
});

it("expose l’activation de progression seulement dans les espaces du membre", async () => {
  const enabled = await setup();
  const disabled = await makeOrg("Sans progression");
  const spaces = await listSpaces(enabled.owner.userId);
  expect(spaces.find((s) => s.organizationId === enabled.organizationId)?.progressionEnabled).toBe(true);
  expect(spaces.some((s) => s.organizationId === disabled.organizationId)).toBe(false);
  expect((await listSpaces(disabled.owner.userId))[0]?.progressionEnabled).toBe(false);
});

it("refuse une date de test inexistante au lieu de la déplacer au mois suivant", async () => {
  const a = await setup();
  await expect(
    addStrengthTest(a.owner.userId, a.organizationId, {
      athleteId: a.athlete.athleteId,
      exerciseId: a.exercise.id,
      exerciseKey: "ignored",
      kind: "one_rm",
      value: 100,
      date: "2026-02-30",
      selectAsReference: true,
    }),
  ).rejects.toThrow();
  expect(await prisma.strengthTest.count({ where: { athleteId: a.athlete.athleteId } })).toBe(0);
});
