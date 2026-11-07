import { prescriptionSchema, sessionSnapshot } from "@tartan/contracts";
import { freezePrescription } from "@tartan/domain";
import type { Prisma } from "@/generated/prisma/client";
import { activeAudienceIds, athleteAssignedWhere } from "./session-audience.service";
import { strengthResolutionInputsForAthletes } from "./strength.service";

// Service interne : appelé seulement après contrôle d'accès, sous verrou de l'espace
// puis de la séance. Aucune note privée, santé ou identité de compte dans les copies.
export const freezeSessionPrescriptions = async (
  tx: Prisma.TransactionClient,
  sessionId: string,
  origin: "publication" | "revision" | "assignment",
  onlyAthleteId?: string,
) => {
  const session = await tx.scheduledSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { organization: { select: { progressionEnabled: true } }, overrides: true },
  });
  if (!session.publishedAt || (!session.organization.progressionEnabled && !session.prescriptionFrozenAt)) return;
  const frozenAt = new Date();
  if (!session.prescriptionFrozenAt)
    await tx.scheduledSession.update({ where: { id: sessionId }, data: { prescriptionFrozenAt: frozenAt } });
  const audience = (await activeAudienceIds(sessionId, tx)).filter((id) => !onlyAthleteId || onlyAthleteId === id);
  if (!audience.length) return;
  const existing = await tx.sessionPrescription.findMany({
    where: { scheduledSessionId: sessionId, athleteId: { in: audience }, sessionVersion: session.version },
    select: { athleteId: true },
  });
  const done = new Set(existing.map((p) => p.athleteId));
  const athletes = audience.filter((id) => !done.has(id));
  if (!athletes.length) return;
  const [references, previous] = await Promise.all([
    strengthResolutionInputsForAthletes(tx, athletes),
    tx.sessionPrescription.findMany({
      where: { scheduledSessionId: sessionId, athleteId: { in: athletes }, sessionVersion: { lt: session.version } },
      orderBy: { sessionVersion: "desc" },
      distinct: ["athleteId"],
    }),
  ]);
  const previousByAthlete = new Map(previous.map((p) => [p.athleteId, sessionSnapshot.parse(p.snapshot)]));
  const snapshot = sessionSnapshot.parse(session.snapshot);
  await tx.sessionPrescription.createMany({
    data: athletes.map((athleteId) => ({
      scheduledSessionId: sessionId,
      athleteId,
      sessionVersion: session.version,
      origin,
      frozenAt,
      snapshot: freezePrescription(
        snapshot,
        references.get(athleteId) ?? [],
        session.overrides
          .filter((o) => o.athleteId === athleteId)
          .map((o) => ({ itemRef: o.itemRef, prescription: prescriptionSchema.parse(o.prescription) })),
        previousByAthlete.get(athleteId),
      ) as unknown as Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  });
};

// L'arrivée dans un groupe prépare les séances déjà publiées au moment de l'attribution,
// sans attendre leur ouverture sur un téléphone et sans attribuer le passé du groupe.
export const freezeAssignedPrescriptions = async (tx: Prisma.TransactionClient, athleteId: string) => {
  const sessions = await tx.scheduledSession.findMany({
    where: { ...(await athleteAssignedWhere(athleteId, tx)), prescriptionFrozenAt: { not: null } },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  for (const session of sessions) {
    await tx.$queryRaw`SELECT id FROM scheduled_sessions WHERE id = ${session.id}::uuid FOR UPDATE`;
    await freezeSessionPrescriptions(tx, session.id, "assignment", athleteId);
  }
};
