import type { ExerciseFamily, ExerciseGuide } from "@tartan/contracts";
import { exerciseClip } from "@tartan/mascot/exercises";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./admin.service";

// Les familles dont le fondateur a relu les gestes animés. Une clé à part : le formulaire de configuration,
// qui réécrit ses propres réglages, ne peut pas l'effacer. Les gestes du moteur actuel forment une série à part,
// « famille:v2 » : une famille validée sur le premier moteur (« famille », « famille:face ») ne la couvre pas,
// puisque le fondateur n'a pas vu ces gestes-là.
const KEY = "motionFamilies";
const CACHE_MS = 30_000;
const families = z.array(z.string().max(60));
let cached: { at: number; value: string[] } | null = null;

export type MotionReviewGroup = `${ExerciseFamily}:v2`;
export const motionReviewGroup = (family: ExerciseFamily): MotionReviewGroup => `${family}:v2`;

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
) => {
  await requireAdmin(actor.email);
  const group = motionReviewGroup(family);
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
        metadata: { family, batch: "v2" },
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
          motion: approved.includes(motionReviewGroup(guide.family)) ? "approved" : "review",
        },
      } as G)
    : guide;
};
