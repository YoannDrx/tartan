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
  const outdatedWhere = {
    organizationId,
    sourceCatalogKey: { not: null },
    catalogVersion: { lt: EXERCISE_CATALOG_VERSION },
    deletedAt: null,
  };
  const [ready, legacy, outdated] = await Promise.all([
    prisma.exercise.count({
      where: {
        organizationId: null,
        catalogKey: { in: EXERCISE_CATALOG.map((entry) => entry.catalogKey) },
        catalogVersion: { gte: EXERCISE_CATALOG_VERSION },
        deletedAt: null,
      },
    }),
    prisma.exercise.count({ where: legacyWhere }),
    prisma.exercise.count({ where: outdatedWhere }),
  ]);
  if (ready === EXERCISE_CATALOG.length && legacy === 0 && outdated === 0) return;
  await prisma.$transaction(
    async (tx) => {
      // Shared catalogue updates and concurrent first visits must serialize across spaces.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(176843, 150)::text`;
      await requireOrgMember(userId, organizationId, "editExercises", tx);
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
      const existing = await tx.exercise.findMany({ where: { catalogKey: { not: null } } });
      const byKey = new Map(existing.map((row) => [row.catalogKey, row]));
      const additions: Prisma.ExerciseCreateManyInput[] = [];
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
        if (!current) additions.push({ ...data, catalogKey: entry.catalogKey });
        else await tx.exercise.update({ where: { id: current.id }, data });
      }
      // The first visit installs the catalogue in one statement, under the same lock.
      // Sequential inserts otherwise delay the first builder on constrained servers.
      if (additions.length) await tx.exercise.createMany({ data: additions });
      // Approval is a catalogue revision, not a change to the coach's exercise or a historical snapshot.
      for (const row of await tx.exercise.findMany({ where: outdatedWhere })) {
        const entry = EXERCISE_CATALOG.find((item) => item.catalogKey === row.sourceCatalogKey);
        if (!entry) continue;
        const oldGuide = readExerciseGuide(row.guide);
        // Only upgrade the exact reviewed text. Detached or customized guides stay untouched.
        const sameContent =
          oldGuide &&
          isDeepStrictEqual(
            {
              ...oldGuide,
              version: entry.guide.version,
              technicalReview: entry.guide.technicalReview,
              illustration: { ...oldGuide.illustration, path: entry.guide.illustration.path },
            },
            entry.guide,
          );
        await tx.exercise.update({
          where: { id: row.id },
          data: { catalogVersion: entry.catalogVersion, ...(sameContent ? { guide: entry.guide } : {}) },
        });
      }
      // A starter copy, customized or not, stands for its catalogue entry: the library never lists
      // the same movement twice. Spaces created before the library carried tags and classification
      // kept copies the old rule thought customized, so the shared entry showed beside them.
      // The guide follows the movement, as for a renamed copy: the coach's own cues and
      // prescription stay, and only a copy reclassified as another movement goes without it.
      const candidates = await tx.exercise.findMany({ where: legacyWhere });
      for (const row of candidates) {
        const entry = EXERCISE_CATALOG.find((item) => item.name === row.name);
        if (!entry) continue;
        const movement = (row.classification as { movement?: string | null } | null)?.movement;
        const starter = STARTER_LIBRARY.find((item) => item.name === row.name);
        // The starter and the catalogue sometimes classify a movement differently: only a coach's change counts.
        const sameMovement =
          !movement || movement === entry.classification.movement || movement === starter?.classification?.movement;
        await tx.exercise.update({
          where: { id: row.id },
          data: {
            sourceCatalogKey: entry.catalogKey,
            catalogVersion: entry.catalogVersion,
            ...(sameMovement ? { guide: entry.guide } : {}),
            // Fields the starter library did not have yet: fill them, never overwrite a choice.
            ...(row.aliases.length ? {} : { aliases: entry.aliases ?? [] }),
            ...(row.tags.length ? {} : { tags: entry.tags }),
            ...(row.classification === null ? { classification: entry.classification } : {}),
            ...(row.strengthLoadKind === null && entry.strengthLoadKind
              ? { strengthLoadKind: entry.strengthLoadKind }
              : {}),
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
