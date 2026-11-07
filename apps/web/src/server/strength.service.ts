import {
  chooseStrengthReference,
  legacyStrengthMappingInput,
  strengthReferenceResponse,
  strengthTestInput,
  type ChooseStrengthReference,
  type StrengthTestInput,
} from "@tartan/contracts";
import { estimatedOneRm, type StrengthTest } from "@tartan/domain";
import { m } from "@tartan/i18n";
import type { Prisma } from "@/generated/prisma/client";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { AppError, forbidden, invalid, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, requireVisibleAthlete } from "./access";

const lockOrganization = async (tx: Prisma.TransactionClient, organizationId: string, needsProgression = false) => {
  const [space] = await tx.$queryRaw<
    { progression_enabled: boolean }[]
  >`SELECT progression_enabled FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
  if (!space) throw forbidden();
  if (needsProgression && !space.progression_enabled)
    throw new AppError(409, "progression_disabled", m.progression.disabled);
};

// Adaptateur interne : les clés historiques restent lisibles, les nouvelles clés
// ne résolvent que la référence choisie, jamais le dernier test ajouté.
export const strengthResolutionInputs = async (db: Prisma.TransactionClient, athleteId: string) => {
  const [tests, references, mappings] = await Promise.all([
    db.strengthTest.findMany({
      where: { athleteId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    }),
    db.strengthReference.findMany({ where: { athleteId }, include: { exercise: { select: { loadStepKg: true } } } }),
    db.legacyStrengthMapping.findMany({ where: { organization: { athletes: { some: { id: athleteId } } } } }),
  ]);
  const mappedAliases = new Set(mappings.map((m) => m.legacyKey));
  const legacy = tests
    .filter((t) => !t.exerciseKey.startsWith("exercise:") && !mappedAliases.has(t.exerciseKey))
    .map((t) => ({
      id: t.id,
      exerciseKey: t.exerciseKey,
      value: Number(t.value),
      kind: t.kind,
      date: fromDbDate(t.date),
      originKind: t.kind,
      sourceTestId: t.id,
      loadKind: t.loadKind,
      stepKg: 1.25,
    }));
  const chosen = references.flatMap((r) => {
    const keys = [
      `exercise:${r.exerciseId}`,
      ...mappings.filter((m) => m.exerciseId === r.exerciseId).map((m) => m.legacyKey),
    ];
    return keys.map((exerciseKey) => ({
      id: r.id,
      exerciseKey,
      value: Number(r.valueKg),
      kind: "one_rm" as const,
      date: fromDbDate(r.selectedAt),
      originKind: r.kind,
      sourceTestId: r.sourceTestId,
      loadKind: r.loadKind,
      stepKg: Number(r.exercise.loadStepKg),
    }));
  });
  return [...legacy, ...chosen] satisfies (StrengthTest & { id: string })[];
};

const eligibleExercise = async (tx: Prisma.TransactionClient, organizationId: string, exerciseId: string) => {
  const exercise = await tx.exercise.findFirst({
    where: { id: exerciseId, deletedAt: null, OR: [{ organizationId }, { organizationId: null }] },
  });
  if (!exercise) throw notFound();
  if (exercise.strengthLoadKind !== "external_total" && exercise.strengthLoadKind !== "added_weight")
    throw invalid(m.strength.unsupported);
  return exercise;
};

const chooseReference = async (
  tx: Prisma.TransactionClient,
  userId: string,
  organizationId: string,
  athleteId: string,
  exerciseId: string,
  input: ChooseStrengthReference,
) => {
  const exercise = await eligibleExercise(tx, organizationId, exerciseId);
  const test =
    input.source === "test"
      ? await tx.strengthTest.findFirst({
          where: { id: input.testId, organizationId, athleteId, exerciseId, loadKind: exercise.strengthLoadKind },
        })
      : null;
  if (input.source === "test" && !test) throw invalid(m.strength.sourceMismatch);
  const data = {
    organizationId,
    athleteId,
    exerciseId,
    valueKg:
      input.source === "working" ? input.valueKg : estimatedOneRm({ value: Number(test!.value), kind: test!.kind }),
    kind: input.source === "working" ? "working" : test!.kind === "one_rm" ? "tested" : "estimated",
    sourceTestId: test?.id ?? null,
    loadKind: exercise.strengthLoadKind!,
    selectedBy: userId,
    selectedAt: new Date(),
  };
  return tx.strengthReference.upsert({
    where: { athleteId_exerciseId: { athleteId, exerciseId } },
    create: data,
    update: data,
  });
};

export const addStrengthTest = async (userId: string, organizationId: string, raw: StrengthTestInput) => {
  const input = strengthTestInput.parse(raw);
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  await requireVisibleAthlete(access, input.athleteId);
  return prisma.$transaction(async (tx) => {
    await lockOrganization(tx, organizationId, Boolean(input.exerciseId || input.selectAsReference));
    const mapping = input.exerciseId
      ? null
      : await tx.legacyStrengthMapping.findUnique({
          where: { organizationId_legacyKey: { organizationId, legacyKey: input.exerciseKey } },
        });
    const exerciseId = input.exerciseId ?? mapping?.exerciseId;
    const exercise = exerciseId ? await eligibleExercise(tx, organizationId, exerciseId) : null;
    if (input.selectAsReference && !exercise) throw invalid(m.strength.unsupported);
    const test = await tx.strengthTest.create({
      data: {
        organizationId,
        athleteId: input.athleteId,
        exerciseKey: input.exerciseId ? `exercise:${input.exerciseId}` : input.exerciseKey,
        exerciseId: exercise?.id,
        loadKind: exercise?.strengthLoadKind,
        value: input.value,
        kind: input.kind,
        date: toDbDate(input.date),
      },
    });
    if (input.selectAsReference && exercise)
      await chooseReference(tx, userId, organizationId, input.athleteId, exercise.id, {
        source: "test",
        testId: test.id,
      });
    return { id: test.id };
  });
};

export const selectStrengthReference = async (
  userId: string,
  organizationId: string,
  athleteId: string,
  exerciseId: string,
  raw: ChooseStrengthReference,
) => {
  const input = chooseStrengthReference.parse(raw);
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  await requireVisibleAthlete(access, athleteId);
  await prisma.$transaction(async (tx) => {
    await lockOrganization(tx, organizationId, true);
    await chooseReference(tx, userId, organizationId, athleteId, exerciseId, input);
  });
  return getExerciseStrength(userId, organizationId, athleteId, exerciseId);
};

export const getExerciseStrength = async (
  userId: string,
  organizationId: string,
  athleteId: string,
  exerciseId: string,
) => {
  const access = await requireOrgMember(userId, organizationId);
  if (access.role === "guardian") throw forbidden();
  await requireVisibleAthlete(access, athleteId);
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, OR: [{ organizationId }, { organizationId: null }] },
  });
  if (!exercise) throw notFound();
  const [reference, tests] = await Promise.all([
    prisma.strengthReference.findUnique({ where: { athleteId_exerciseId: { athleteId, exerciseId } } }),
    prisma.strengthTest.findMany({
      where: { organizationId, athleteId, exerciseId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    }),
  ]);
  return strengthReferenceResponse.parse({
    exercise: {
      id: exercise.id,
      name: exercise.name,
      loadKind: exercise.strengthLoadKind,
      stepKg: Number(exercise.loadStepKg),
    },
    reference: reference
      ? { ...reference, valueKg: Number(reference.valueKg), selectedAt: reference.selectedAt.toISOString() }
      : null,
    tests: tests.map((test) => ({ ...test, value: Number(test.value), date: fromDbDate(test.date) })),
  });
};

export const strengthMappingReport = async (userId: string, organizationId: string) => {
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  if (access.role !== "owner") throw forbidden();
  const [unmapped, mappings] = await Promise.all([
    prisma.strengthTest.groupBy({ by: ["exerciseKey"], where: { organizationId, exerciseId: null }, _count: true }),
    prisma.legacyStrengthMapping.findMany({
      where: { organizationId },
      select: { legacyKey: true, exerciseId: true, reason: true },
    }),
  ]);
  return { unmapped: unmapped.map((row) => ({ legacyKey: row.exerciseKey, count: row._count })), mappings };
};

// Correspondance confirmée par le propriétaire, jamais inférée d'un nom ou d'une ressemblance.
export const confirmStrengthMapping = async (userId: string, organizationId: string, raw: unknown) => {
  const input = legacyStrengthMappingInput.parse(raw);
  const access = await requireOrgMember(userId, organizationId, "manageAthletes");
  if (access.role !== "owner") throw forbidden();
  await prisma.$transaction(async (tx) => {
    await lockOrganization(tx, organizationId, true);
    const exercise = await eligibleExercise(tx, organizationId, input.exerciseId);
    const previous = await tx.legacyStrengthMapping.findUnique({
      where: { organizationId_legacyKey: { organizationId, legacyKey: input.legacyKey } },
    });
    const conflicting = await tx.strengthTest.count({
      where: { organizationId, exerciseKey: input.legacyKey, exerciseId: { not: input.exerciseId } },
    });
    if ((previous && previous.exerciseId !== input.exerciseId) || conflicting > 0)
      throw new AppError(409, "strength_mapping_conflict", m.strength.mappingConflict);
    const mapping =
      previous ??
      (await tx.legacyStrengthMapping.create({
        data: {
          organizationId,
          legacyKey: input.legacyKey,
          exerciseId: input.exerciseId,
          confirmedBy: userId,
          reason: input.reason,
        },
      }));
    const linked = await tx.strengthTest.updateMany({
      where: { organizationId, exerciseKey: input.legacyKey, exerciseId: null },
      data: { exerciseId: exercise.id, loadKind: exercise.strengthLoadKind },
    });
    if (!previous || linked.count)
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: userId,
          action: "strength_mapping_confirmed",
          entity: "legacy_strength_mapping",
          entityId: mapping.id,
        },
      });
  });
  return strengthMappingReport(userId, organizationId);
};
