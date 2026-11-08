import { storedPhaseContext } from "./session-phase-context";
import { createHash } from "node:crypto";
import { prescriptionRefreshPreview, prescriptionSchema, sessionSnapshot } from "@tartan/contracts";
import { freezePrescription, refreshPrescriptionLoads } from "@tartan/domain";
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
  const context = storedPhaseContext.safeParse(session.phaseContext);
  const phases = new Map(context.success ? context.data.athletes.map((a) => [a.athleteId, a]) : []);
  await tx.sessionPrescription.createMany({
    data: athletes.map((athleteId) => ({
      scheduledSessionId: sessionId,
      athleteId,
      sessionVersion: session.version,
      origin,
      frozenAt,
      phaseId: phases.get(athleteId)?.phaseId ?? null,
      phaseVersion: phases.get(athleteId)?.phaseVersion ?? null,
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

// Lecture interne sous les mêmes verrous que publication, références et validations.
// Aucun retour de santé ni note privée : seul l'existence d'une saisie exclut l'athlète.
export const preparePrescriptionRefresh = async (tx: Prisma.TransactionClient, sessionId: string) => {
  const session = await tx.scheduledSession.findUniqueOrThrow({ where: { id: sessionId } });
  const audience = (await activeAudienceIds(sessionId, tx)).sort();
  const [athletes, logs, copies, references] = await Promise.all([
    tx.athlete.findMany({ where: { id: { in: audience } }, select: { id: true, firstName: true, lastName: true } }),
    tx.sessionLog.findMany({
      where: { scheduledSessionId: sessionId, athleteId: { in: audience } },
      select: { athleteId: true },
    }),
    tx.sessionPrescription.findMany({
      where: { scheduledSessionId: sessionId, athleteId: { in: audience }, sessionVersion: { lte: session.version } },
      orderBy: { sessionVersion: "desc" },
      distinct: ["athleteId"],
    }),
    strengthResolutionInputsForAthletes(tx, audience),
  ]);
  const recorded = new Set(logs.map((row) => row.athleteId));
  const byAthlete = new Map(copies.map((row) => [row.athleteId, row]));
  const rows = audience.map((athleteId) => {
    const athlete = athletes.find((row) => row.id === athleteId)!;
    const identity = { athleteId, name: `${athlete.firstName} ${athlete.lastName}` };
    const copy = byAthlete.get(athleteId);
    if (recorded.has(athleteId))
      return { ...identity, status: "recorded" as const, changes: [], incompatible: [], snapshot: null };
    // Pas de reconstruction d'une ancienne prescription à partir d'un maximum récent.
    if (!copy) return { ...identity, status: "unfrozen" as const, changes: [], incompatible: [], snapshot: null };
    const result = refreshPrescriptionLoads(sessionSnapshot.parse(copy.snapshot), references.get(athleteId) ?? []);
    return { ...identity, status: result.changes.length ? ("ready" as const) : ("unchanged" as const), ...result };
  });
  rows.sort(
    (a, b) =>
      Number(b.status === "ready") - Number(a.status === "ready") ||
      a.name.localeCompare(b.name, "fr") ||
      a.athleteId.localeCompare(b.athleteId),
  );
  // Le jeton lie l'aperçu à l'espace, la version, l'audience, les sources et les valeurs.
  // Ce n'est pas une autorisation : chaque confirmation recontrôle les accès.
  const token = createHash("sha256")
    .update(JSON.stringify({ organizationId: session.organizationId, sessionId, version: session.version, rows }))
    .digest("hex");
  return {
    preview: prescriptionRefreshPreview.parse({ sessionId, sessionVersion: session.version, token, athletes: rows }),
    updates: rows
      .filter((row) => row.status === "ready" && row.snapshot)
      .map((row) => ({
        athleteId: row.athleteId,
        snapshot: row.snapshot!,
        phaseId: byAthlete.get(row.athleteId)?.phaseId ?? null,
        phaseVersion: byAthlete.get(row.athleteId)?.phaseVersion ?? null,
      })),
  };
};
