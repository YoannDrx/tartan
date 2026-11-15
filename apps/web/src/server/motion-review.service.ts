import { exerciseFamily, type ExerciseFamily, type ExerciseGuide } from "@tartan/contracts";
import { exerciseClip } from "@tartan/mascot/exercises";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./admin.service";

// Les familles dont le fondateur a relu les gestes animés. Une clé à part : le formulaire de configuration,
// qui réécrit ses propres réglages, ne peut pas l'effacer.
const KEY = "motionFamilies";
const CACHE_MS = 30_000;
const families = z.array(exerciseFamily);
let cached: { at: number; value: ExerciseFamily[] } | null = null;

export const approvedMotionFamilies = async (): Promise<ExerciseFamily[]> => {
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
  const current = await approvedMotionFamilies();
  const next = approved ? [...new Set([...current, family])] : current.filter((value) => value !== family);
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
        metadata: { family },
      },
    }),
  ]);
  cached = null;
};

// Le geste animé se lit au moment de l'affichage, d'après la clé du catalogue : une séance déjà publiée,
// dont le guide est figé, reçoit aussi les gestes arrivés depuis.
export const withMotion = <G extends ExerciseGuide | null | undefined>(guide: G, approved: readonly ExerciseFamily[]): G =>
  guide && exerciseClip(guide.catalogKey)
    ? ({
        ...guide,
        illustration: { ...guide.illustration, motion: approved.includes(guide.family) ? "approved" : "review" },
      } as G)
    : guide;
