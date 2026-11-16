import type { ExerciseFamily, ExerciseGuide } from "@tartan/contracts";
import type { MotionBatch } from "@tartan/mascot/exercise";
import { exerciseClip } from "@tartan/mascot/exercises";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./admin.service";

// Les familles dont le fondateur a relu les gestes animés. Une clé à part : le formulaire de configuration,
// qui réécrit ses propres réglages, ne peut pas l'effacer. Une série arrivée après coup (les gestes vus de face)
// se valide à part, sous « famille:série » : la validation d'une famille ne couvre que les gestes qu'il a vus.
const KEY = "motionFamilies";
const CACHE_MS = 30_000;
const families = z.array(z.string().max(60));
let cached: { at: number; value: string[] } | null = null;

export type MotionReviewGroup = ExerciseFamily | `${ExerciseFamily}:${MotionBatch}`;
export const motionReviewGroup = (family: ExerciseFamily, batch?: MotionBatch): MotionReviewGroup =>
  batch ? `${family}:${batch}` : family;

export const approvedMotionFamilies = async (): Promise<string[]> => {
  const now = Date.now();
  if (process.env.NODE_ENV !== "test" && cached && now - cached.at < CACHE_MS) return cached.value;
  const row = await prisma.platformSetting.findUnique({ where: { key: KEY } }).catch(() => null);
  const parsed = families.safeParse(row?.value ?? []);
  const value = parsed.success ? parsed.data : [];
  cached = { at: now, value };
  return value;
};

export const setMotionFamilyApproval = async (
  actor: { email: string; userId: string },
  family: ExerciseFamily,
  approved: boolean,
  batch?: MotionBatch,
) => {
  await requireAdmin(actor.email);
  const group = motionReviewGroup(family, batch);
  const current = await approvedMotionFamilies();
  const next = approved ? [...new Set([...current, group])] : current.filter((value) => value !== group);
  await prisma.$transaction([
    prisma.platformSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: next, updatedById: actor.userId },
      update: { value: next, updatedById: actor.userId },
    }),
    prisma.auditLog.create({
      data: {
        actorId: actor.userId,
        action: approved ? "motion_family_approved" : "motion_family_reopened",
        entity: "platform_settings",
        metadata: { family, ...(batch ? { batch } : {}) },
      },
    }),
  ]);
  cached = null;
};

// Le geste animé se lit au moment de l'affichage, d'après la clé du catalogue : une séance déjà publiée,
// dont le guide est figé, reçoit aussi les gestes arrivés depuis.
export const withMotion = <G extends ExerciseGuide | null | undefined>(guide: G, approved: readonly string[]): G => {
  const clip = guide ? exerciseClip(guide.catalogKey) : null;
  return guide && clip
    ? ({
        ...guide,
        illustration: {
          ...guide.illustration,
          motion: approved.includes(motionReviewGroup(guide.family, clip.batch)) ? "approved" : "review",
        },
      } as G)
    : guide;
};
