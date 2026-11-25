import type { ExerciseGuide } from "@tartan/contracts";
import { EXERCISE_CATALOG, STADIUM_EDITION, guideMatchesCatalog } from "@tartan/domain/exercise-catalog";
import { gestureClip } from "@tartan/mascot/v2/registry";
import { Prisma } from "@/generated/prisma/client";
import { invalid } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/session";
import { requireStepUp, STEP_UP_READ_MS } from "./admin-step-up.service";
import { catalogImages, imagePath } from "./catalog-illustrations";

import { legacyCovers, legacyCoverStamp } from "./legacy-catalog-covers";

const prefix = "exerciseReview:";
export const mediaKinds = ["text", "image", "motion"] as const;
type Kind = (typeof mediaKinds)[number];
const byKey = new Map<string, (typeof catalogImages)[number]>(catalogImages.map((p) => [p.key, p]));
export const stamp = (key: string, guideVersion: number, kind: Kind) => {
  const assetVersion = kind === "image" ? (byKey.get(key)?.imageVersion ?? 0) : kind === "motion" ? 2 : guideVersion;
  return `${prefix}${key}:v${guideVersion}:${kind}:v${assetVersion}`;
};
export async function unversionedCommonExercises(actor: Actor) {
  await requireStepUp(actor, STEP_UP_READ_MS);
  const known = [...EXERCISE_CATALOG, ...STADIUM_EDITION].map((entry) => entry.catalogKey);
  return prisma.exercise.findMany({
    where: { organizationId: null, deletedAt: null, OR: [{ catalogKey: null }, { catalogKey: { notIn: known } }] },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, catalogKey: true, sourceCatalogKey: true, updatedAt: true },
  });
}
// Le guide relu rejoint la fiche historique en place. Les vidéos, favoris et références de séance gardent son identifiant.
export async function linkLegacyGuide(actor: Actor, id: string, updatedAt: Date, target: string | null) {
  await requireStepUp(actor, STEP_UP_READ_MS);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(176843, 150)::text`;
    const row = await tx.exercise.findFirst({
      where: { id, organizationId: null, catalogKey: null, deletedAt: null },
      select: { guide: true, sourceCatalogKey: true, updatedAt: true },
    });
    if (!row || (!row.sourceCatalogKey && row.guide !== null)) throw invalid();
    if (row.sourceCatalogKey === target) return;
    if (row.updatedAt.getTime() !== updatedAt.getTime()) throw invalid();
    const entry = [...EXERCISE_CATALOG, ...STADIUM_EDITION].find((e) => e.catalogKey === target);
    if (target) {
      if (!entry) throw invalid();
      const reviews = await tx.platformSetting.findMany({
        where: { key: { in: mediaKinds.map((kind) => stamp(entry.catalogKey, entry.catalogVersion, kind)) } },
        select: { value: true },
      });
      if (reviews.filter((r) => r.value === true).length !== mediaKinds.length) throw invalid();
    }
    const result = await tx.exercise.updateMany({
      where: { id, organizationId: null, catalogKey: null, deletedAt: null, updatedAt },
      data: {
        sourceCatalogKey: target,
        catalogVersion: entry?.catalogVersion ?? null,
        guide: entry ? { ...entry.guide, technicalReview: "approved" } : Prisma.DbNull,
      },
    });
    if (result.count !== 1) throw invalid();
  });
}
export async function reviewLegacyCover(actor: Actor, id: string, expectedStamp: string, approved: boolean) {
  await requireStepUp(actor, STEP_UP_READ_MS);
  const cover = legacyCovers.get(id);
  if (!cover || legacyCoverStamp(cover) !== expectedStamp) throw invalid();
  const existing = await prisma.exercise.findFirst({
    where: { id, organizationId: null, deletedAt: null, catalogKey: null },
    select: { id: true },
  });
  if (!existing) throw invalid();
  await prisma.platformSetting.upsert({
    where: { key: expectedStamp },
    create: { key: expectedStamp, value: approved, updatedById: actor.userId },
    update: { value: approved, updatedById: actor.userId },
  });
}

export async function approvedEditorial() {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { startsWith: prefix } },
    select: { key: true, value: true },
  });
  return new Set(
    rows.flatMap(({ key, value }) => (value === true ? [key] : value === false ? [`reopened:${key}`] : [])),
  );
}
export async function reviewEditorial(
  actor: Actor,
  key: string,
  version: number,
  kind: Kind,
  approved: boolean,
  expectedStamp: string,
) {
  await requireStepUp(actor, STEP_UP_READ_MS);
  const entry = [...EXERCISE_CATALOG, ...STADIUM_EDITION].find(
    (e) => e.catalogKey === key && e.catalogVersion === version,
  );
  const stampKey = stamp(key, version, kind);
  if (
    !entry ||
    expectedStamp !== stampKey ||
    (kind === "image" && byKey.get(key)?.guideVersion !== version) ||
    (kind === "motion" && !gestureClip(key))
  )
    throw invalid();
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(176843, 150)::text`;
    await tx.platformSetting.upsert({
      where: { key: stampKey },
      create: { key: stampKey, value: approved, updatedById: actor.userId },
      update: { value: approved, updatedById: actor.userId },
    });
    if (kind === "text") {
      await tx.exercise.updateMany({
        where: { organizationId: null, catalogKey: null, sourceCatalogKey: key, catalogVersion: version },
        data: { guide: { ...entry.guide, technicalReview: approved ? "approved" : "pending" } },
      });
    }
    if (!STADIUM_EDITION.some((e) => e.catalogKey === key)) return;
    if (!approved) {
      if (kind === "text")
        await tx.exercise.updateMany({
          where: { catalogKey: key, catalogVersion: version, organizationId: null },
          data: { guide: entry.guide },
        });
      return;
    }
    const approvals = await tx.platformSetting.findMany({
      where: { key: { in: mediaKinds.map((k) => stamp(key, version, k)) } },
      select: { value: true },
    });
    if (approvals.filter((r) => r.value === true).length !== mediaKinds.length) return;
    const data = {
      name: entry.name,
      category: entry.category,
      aliases: entry.aliases ?? [],
      tags: entry.tags,
      classification: entry.classification,
      cues: entry.cues,
      defaultPrescription: entry.prescription,
      strengthLoadKind: entry.strengthLoadKind,
      catalogVersion: version,
      guide: { ...entry.guide, technicalReview: "approved" },
    };
    await tx.exercise.upsert({ where: { catalogKey: key }, create: { ...data, catalogKey: key }, update: data });
  });
}
export function withApprovedImage<G extends ExerciseGuide | null | undefined>(
  guide: G,
  reviewed: ReadonlySet<string>,
): G {
  if (!guide) return guide;
  const pilot = byKey.get(guide.catalogKey);
  if (guide.author !== "coach" && pilot?.guideVersion === guide.version) {
    const motionKey = stamp(pilot.key, guide.version, "motion");
    const textKey = stamp(pilot.key, guide.version, "text");
    const stadium = STADIUM_EDITION.some((e) => e.catalogKey === pilot.key);
    const motion = reviewed.has(motionKey)
      ? "approved"
      : stadium || reviewed.has(`reopened:${motionKey}`)
        ? "review"
        : guide.illustration.motion;
    if (guide.illustration.motion !== motion) guide = { ...guide, illustration: { ...guide.illustration, motion } };
    if (guideMatchesCatalog(guide)) {
      const text = reviewed.has(textKey)
        ? "approved"
        : reviewed.has(`reopened:${textKey}`)
          ? "pending"
          : guide.technicalReview;
      if (guide.technicalReview !== text) guide = { ...guide, technicalReview: text };
    }
  }
  if (
    guide.author === "coach" ||
    !pilot ||
    pilot.guideVersion !== guide.version ||
    !reviewed.has(stamp(pilot.key, pilot.guideVersion, "image"))
  ) {
    if (!guide.illustration.photo) return guide;
    const { photo: _photo, ...illustration } = guide.illustration;
    return { ...guide, illustration };
  }
  return { ...guide, illustration: { ...guide.illustration, photo: { path: imagePath(pilot), alt: pilot.alt } } };
}
