import { platformSettingsInput, type PlatformSettings } from "@tartan/contracts";
import { env } from "@/lib/env";
import { invalid } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./admin.service";

const CACHE_MS = 30_000;
let cached: { at: number; value: PlatformSettings } | null = null;

const fromEnv = (): PlatformSettings => {
  const e = env();
  const limit = Number(e.MUX_VIDEO_LIMIT);
  return {
    signupMode: e.COACH_SIGNUP_MODE,
    checkoutEnabled: e.BILLING_CHECKOUT_ENABLED === "true",
    muxVideoLimit: limit > 0 ? limit : null,
    gameLeaderboardEnabled: false,
  };
};

// Réglés depuis la console, sans redéploiement. La variable d'environnement reste la valeur par défaut, et le repli si la base répond mal.
export const platformSettings = async (): Promise<PlatformSettings> => {
  const now = Date.now();
  if (process.env.NODE_ENV !== "test" && cached && now - cached.at < CACHE_MS) return cached.value;
  const defaults = fromEnv();
  const rows = await prisma.platformSetting.findMany().catch(() => null);
  if (!rows) return defaults;
  const stored = platformSettingsInput.partial().safeParse(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  const value = { ...defaults, ...(stored.success ? stored.data : {}) };
  cached = { at: now, value };
  return value;
};

export const updatePlatformSettings = async (actor: { email: string; userId: string }, input: unknown) => {
  await requireAdmin(actor.email);
  const parsed = platformSettingsInput.safeParse(input);
  if (!parsed.success) throw invalid();
  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(parsed.data)) {
      await tx.platformSetting.upsert({
        where: { key },
        create: { key, value: value as never, updatedById: actor.userId },
        update: { value: value as never, updatedById: actor.userId },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "platform_settings_updated",
        entity: "platform_settings",
        metadata: {
          signupMode: parsed.data.signupMode,
          checkoutEnabled: parsed.data.checkoutEnabled,
          muxVideoLimit: parsed.data.muxVideoLimit ?? "none",
        },
      },
    });
  });
  cached = null;
};
