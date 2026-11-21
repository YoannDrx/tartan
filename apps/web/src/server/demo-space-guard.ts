import type { DemoSpaceCut } from "@tartan/domain";
import { w } from "@tartan/i18n/web";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

// Ce qui garde l'espace de démonstration à part. Chaque service qui fait sortir quelque chose d'un espace (e-mail,
// notification, facture, statistique, mesure d'audience) ou qui y ferait entrer quelqu'un (invitation) l'exclut
// explicitement, par l'un de ces trois outils, et le dit dans son test (`tests/demo-space.test.ts`).

// Filtre d'une requête sur les espaces : seuls les espaces réels.
export const REAL_SPACES = { isDemo: false } as const satisfies Prisma.OrganizationWhereInput;

export const isDemoSpace = async (
  organizationId: string | null | undefined,
  db: Prisma.TransactionClient = prisma,
): Promise<boolean> => {
  if (!organizationId) return false;
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { isDemo: true } });
  return org?.isDemo === true;
};

// Refus d'une fonction coupée, avec sa raison en toutes lettres : le coach comprend pourquoi rien ne se passe.
export const assertNotDemoSpace = async (
  organizationId: string,
  cut: DemoSpaceCut,
  db: Prisma.TransactionClient = prisma,
): Promise<void> => {
  if (await isDemoSpace(organizationId, db)) throw new AppError(403, "demo_space", w.demoSpace.cut[cut]);
};
