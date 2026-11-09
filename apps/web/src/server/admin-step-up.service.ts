import { m } from "@tartan/i18n";
import { AppError, forbidden } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "./admin.service";

const HOUR = 3_600_000;
export const STEP_UP_READ_MS = 12 * HOUR;
export const STEP_UP_MONEY_MS = 10 * 60_000;

type AdminActor = { email: string; userId: string; sessionId?: string };

// Réservé aux navigateurs de test : jamais actif sur une plateforme Vercel.
const bypassed = () => process.env.E2E_DISABLE_ADMIN_STEP_UP === "true" && !process.env.VERCEL;

export const hasFreshStepUp = async (
  sessionId: string | undefined,
  maxAgeMs: number,
  now: Date = new Date(),
): Promise<boolean> => {
  if (bypassed()) return true;
  if (!sessionId) return false;
  const row = await prisma.adminStepUp.findUnique({ where: { sessionId } });
  return row !== null && now.getTime() - row.verifiedAt.getTime() <= maxAgeMs;
};

export const requireStepUp = async (actor: AdminActor, maxAgeMs: number, now: Date = new Date()): Promise<void> => {
  if (!(await isAdmin(actor.email))) throw forbidden();
  if (!(await hasFreshStepUp(actor.sessionId, maxAgeMs, now))) {
    throw new AppError(403, "step_up_required", m.admin.stepUpRequired);
  }
};

// Appelé après la vérification d'une passkey : la session créée à cet instant devient vérifiée.
export const recordStepUp = async (sessionId: string, method: string, now: Date = new Date()): Promise<void> => {
  await prisma.adminStepUp.upsert({
    where: { sessionId },
    create: { sessionId, method, verifiedAt: now },
    update: { method, verifiedAt: now },
  });
};

export const adminHasPasskey = async (userId: string): Promise<boolean> =>
  (await prisma.passkey.count({ where: { userId } })) > 0;
