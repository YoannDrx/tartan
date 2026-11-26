import { prescriptionSchema, sessionSnapshot } from "@tartan/contracts";
import { freezePrescription } from "@tartan/domain";
import type { Prisma } from "@/generated/prisma/client";

// La fiche d'un athlète et son fil de consigne lisent exactement la même prescription.
export async function effectiveSessionSnapshot(
  db: Prisma.TransactionClient,
  session: {
    id: string;
    version: number;
    prescriptionFrozenAt: Date | null;
    snapshot: Prisma.JsonValue;
    overrides: { itemRef: string; prescription: Prisma.JsonValue }[];
  },
  athleteId: string,
  log: { prescriptionSnapshot: Prisma.JsonValue; sessionVersion: number | null } | null,
) {
  if (log?.prescriptionSnapshot)
    return { snapshot: sessionSnapshot.parse(log.prescriptionSnapshot), individualized: true };
  if (!session.prescriptionFrozenAt)
    return { snapshot: sessionSnapshot.parse(session.snapshot), individualized: false };
  const stored = await db.sessionPrescription.findFirst({
    where: {
      scheduledSessionId: session.id,
      athleteId,
      sessionVersion: { lte: log?.sessionVersion ?? session.version },
    },
    orderBy: { sessionVersion: "desc" },
    select: { snapshot: true },
  });
  const snapshot = stored
    ? sessionSnapshot.parse(stored.snapshot)
    : freezePrescription(
        sessionSnapshot.parse(session.snapshot),
        [],
        session.overrides.map((o) => ({ itemRef: o.itemRef, prescription: prescriptionSchema.parse(o.prescription) })),
      );
  return { snapshot, individualized: true };
}
