import { isDeepStrictEqual } from "node:util";
import { STARTER_LIBRARY } from "@tartan/domain";
import { EXERCISE_CATALOG, EXERCISE_CATALOG_VERSION } from "@tartan/domain/exercise-catalog";
import { exerciseGuide } from "@tartan/contracts";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "./access";

export const readExerciseGuide = (value: unknown) => {
  const parsed = exerciseGuide.safeParse(value);
  return parsed.success ? parsed.data : null;
};

/** Add catalogue versions without changing a coach's prescriptions or historical IDs. */
export const ensureExerciseCatalog = async (userId: string, organizationId: string) => {
  await requireOrgMember(userId, organizationId, "editExercises");
  const legacyWhere = {
    organizationId,
    sourceCatalogKey: null,
    deletedAt: null,
    name: { in: STARTER_LIBRARY.map((entry) => entry.name) },
  };
  const [ready, legacy] = await Promise.all([
    prisma.exercise.count({
      where: {
        organizationId: null,
        catalogKey: { in: EXERCISE_CATALOG.map((entry) => entry.catalogKey) },
        catalogVersion: { gte: EXERCISE_CATALOG_VERSION },
        deletedAt: null,
      },
    }),
    prisma.exercise.count({ where: legacyWhere }),
  ]);
  if (ready === EXERCISE_CATALOG.length && legacy === 0) return;
  await prisma.$transaction(
    async (tx) => {
      // Shared catalogue updates and concurrent first visits must serialize across spaces.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(176843, 150)::text`;
      await requireOrgMember(userId, organizationId, "editExercises", tx);
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
      const existing = await tx.exercise.findMany({ where: { catalogKey: { not: null } } });
      const byKey = new Map(existing.map((row) => [row.catalogKey, row]));
      for (const entry of EXERCISE_CATALOG) {
        const current = byKey.get(entry.catalogKey);
        if (current && (current.catalogVersion ?? 0) >= entry.catalogVersion) continue;
        const data = {
          name: entry.name,
          category: entry.category,
          aliases: entry.aliases ?? [],
          tags: entry.tags,
          classification: entry.classification,
          cues: entry.cues,
          defaultPrescription: entry.prescription,
          strengthLoadKind: entry.strengthLoadKind,
          catalogVersion: entry.catalogVersion,
          guide: entry.guide,
          deletedAt: null,
        };
        await tx.exercise.upsert({
          where: { catalogKey: entry.catalogKey },
          create: { ...data, catalogKey: entry.catalogKey },
          update: data,
        });
      }
      // Only untouched starter copies can inherit an editorial guide automatically.
      const candidates = await tx.exercise.findMany({
        where: legacyWhere,
        include: { media: true },
      });
      for (const row of candidates) {
        const starter = STARTER_LIBRARY.find((entry) => entry.name === row.name);
        if (!starter || row.media.length || Number(row.loadStepKg) !== 1.25) continue;
        const unchanged = isDeepStrictEqual(
          [
            row.category,
            row.aliases,
            row.tags,
            row.cues,
            row.classification,
            row.defaultPrescription,
            row.strengthLoadKind,
          ],
          [
            starter.category,
            starter.aliases ?? [],
            starter.tags,
            starter.cues,
            starter.classification,
            starter.prescription,
            starter.strengthLoadKind,
          ],
        );
        if (!unchanged) continue;
        const entry = EXERCISE_CATALOG.find((item) => item.name === row.name)!;
        await tx.exercise.update({
          where: { id: row.id },
          data: {
            sourceCatalogKey: entry.catalogKey,
            catalogVersion: entry.catalogVersion,
            guide: entry.guide,
          },
        });
      }
    },
    { timeout: 20000 },
  );
};

/** A changed private movement must not keep an unrelated inherited demonstration. */
export const retainedExerciseGuide = (
  existing: {
    name: string;
    cues: string[];
    classification: Prisma.JsonValue;
    strengthLoadKind: string | null;
    guide: Prisma.JsonValue;
  },
  input: { name: string; cues: string[]; classification?: unknown; strengthLoadKind?: string | null },
) =>
  existing.name === input.name &&
  isDeepStrictEqual(existing.cues, input.cues) &&
  (input.classification === undefined || isDeepStrictEqual(existing.classification, input.classification)) &&
  (input.strengthLoadKind === undefined || existing.strengthLoadKind === input.strengthLoadKind)
    ? undefined
    : Prisma.DbNull;
