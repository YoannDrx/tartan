import type { ExerciseGuide } from "@tartan/contracts";
import { EXERCISE_CATALOG, STADIUM_EDITION } from "@tartan/domain/exercise-catalog";
import { exerciseClip } from "@tartan/mascot/exercises";
import { invalid } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/session";
import { requireStepUp, STEP_UP_READ_MS } from "./admin-step-up.service";
import { pilots, imagePath } from "./catalog-illustrations";

const prefix = "exerciseReview:";
export const mediaKinds = ["text", "image", "motion"] as const;
type Kind = (typeof mediaKinds)[number];
const byKey = new Map<string, (typeof pilots)[number]>(pilots.map((p) => [p.key, p]));
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
    select: { id: true, name: true },
  });
}
export async function approvedEditorial() {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { startsWith: prefix } },
    select: { key: true, value: true },
  });
  return new Set(rows.filter((r) => r.value === true).map((r) => r.key));
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
    (kind === "motion" && !exerciseClip(key))
  )
    throw invalid();
  await prisma.platformSetting.upsert({
    where: { key: stampKey },
    create: { key: stampKey, value: approved, updatedById: actor.userId },
    update: { value: approved, updatedById: actor.userId },
  });
}
export function withApprovedImage<G extends ExerciseGuide | null | undefined>(
  guide: G,
  reviewed: ReadonlySet<string>,
): G {
  if (!guide || guide.author === "coach") return guide;
  const pilot = byKey.get(guide.catalogKey);
  if (!pilot || pilot.guideVersion !== guide.version || !reviewed.has(stamp(pilot.key, pilot.guideVersion, "image")))
    return guide;
  return { ...guide, illustration: { ...guide.illustration, photo: { path: imagePath(pilot), alt: pilot.alt } } };
}
