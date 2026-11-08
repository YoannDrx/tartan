import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { uuid, plannerUsageResponse } from "@tartan/contracts";
import { plannerQuotaFits, plannerLimits, PLANNER_MAX_AUDIO_SECONDS } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { AppError, forbidden, notFound } from "@/lib/errors";
import type { AiPlannerOperation, Prisma } from "@/generated/prisma/client";
import { requireOrgMember } from "../access";

const inputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: uuid,
      kind: z.literal("clarification"),
      proposalId: uuid,
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
  z.object({ id: uuid, kind: z.literal("proposal"), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z
    .object({
      id: uuid,
      kind: z.literal("transcription"),
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
      audioSeconds: z.number().int().positive().max(PLANNER_MAX_AUDIO_SECONDS),
    })
    .strict(),
]);
type OperationInput = z.infer<typeof inputSchema>;
const resultSchema = z.object({ proposalId: uuid, version: z.number().int().positive() }).strict();
export type PlannerResultReference = z.infer<typeof resultSchema>;
export type PlannerOperationClaim =
  | { state: "claimed"; leaseToken: string }
  | { state: "pending" }
  | { state: "succeeded"; result: PlannerResultReference }
  | { state: "refunded" };
const disabled = () => new AppError(403, "planner_disabled", m.aiPlanner.disabled);
const conflict = () => new AppError(409, "planner_request_conflict", m.aiPlanner.requestConflict);
const where = (organizationId: string, id: string) => ({ organizationId_id: { organizationId, id } });
const quotaWhere = (operation: Pick<AiPlannerOperation, "organizationId" | "month">) => ({
  organizationId_month: { organizationId: operation.organizationId, month: operation.month },
});
const stateOf = (row: AiPlannerOperation): PlannerOperationClaim =>
  row.state === "succeeded"
    ? { state: "succeeded", result: resultSchema.parse(row.result) }
    : { state: row.state === "pending" ? "pending" : "refunded" };
const lock = async (tx: Prisma.TransactionClient, organizationId: string) => {
  await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
};
const monthAt = (now: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
};
const enabled = (organization: { aiPlannerEnabled: boolean; plan: string }) =>
  env().AI_PLANNER_ENABLED === "true" && organization.aiPlannerEnabled && organization.plan !== "discovery";

async function refund(tx: Prisma.TransactionClient, row: AiPlannerOperation, code: string) {
  if (row.state !== "pending") return;
  await tx.aiPlannerQuota.update({
    where: quotaWhere(row),
    data: {
      reservedProposals: { decrement: row.proposalCost },
      reservedAudioSeconds: { decrement: row.audioSeconds },
    },
  });
  await tx.aiPlannerOperation.update({
    where: where(row.organizationId, row.id),
    data: { state: "refunded", failureCode: code, leaseToken: null },
  });
}

// Appelé sous verrou d’espace : une requête fraîche récupère les réservations
// expirées sans attendre le prochain cron. Agrégation par mois, pas une requête par seconde audio.
async function refundExpired(tx: Prisma.TransactionClient, organizationId: string, now: Date) {
  const expiredWhere = { organizationId, state: "pending", leaseUntil: { lte: now } };
  const months = await tx.aiPlannerOperation.groupBy({
    by: ["month"],
    where: expiredWhere,
    _sum: { proposalCost: true, audioSeconds: true },
    _count: { _all: true },
  });
  for (const group of months) {
    await tx.aiPlannerQuota.update({
      where: quotaWhere({ organizationId, month: group.month }),
      data: {
        reservedProposals: { decrement: group._sum.proposalCost ?? 0 },
        reservedAudioSeconds: { decrement: group._sum.audioSeconds ?? 0 },
      },
    });
  }
  if (months.length)
    await tx.aiPlannerOperation.updateMany({
      where: expiredWhere,
      data: {
        state: "refunded",
        failureCode: "lease_expired",
        leaseToken: null,
      },
    });
  return months.reduce((sum, group) => sum + group._count._all, 0);
}

// Usage interne au workflow : l’empreinte est calculée côté serveur, la durée audio
// doit être mesurée côté serveur. Aucun de ces paramètres ne constitue une API publique.
export async function reservePlannerOperation(
  userId: string,
  organizationId: string,
  raw: OperationInput,
  now = new Date(),
  onClaim?: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<PlannerOperationClaim> {
  const input = inputSchema.parse(raw);
  await requireOrgMember(userId, organizationId, "manageSessions");
  if (env().AI_PLANNER_ENABLED !== "true") throw disabled();
  return prisma.$transaction(
    async (tx) => {
      await lock(tx, organizationId);
      await requireOrgMember(userId, organizationId, "manageSessions", tx);
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { aiPlannerEnabled: true, plan: true, timeZone: true },
      });
      if (!enabled(organization)) throw disabled();
      await refundExpired(tx, organizationId, now);
      const previous = await tx.aiPlannerOperation.findUnique({ where: where(organizationId, input.id) });
      if (previous) {
        if (previous.actorId !== userId) throw forbidden();
        if (
          previous.fingerprint !== input.fingerprint ||
          previous.kind !== input.kind ||
          previous.proposalId !== (input.kind === "clarification" ? input.proposalId : null) ||
          previous.audioSeconds !== (input.kind === "transcription" ? input.audioSeconds : 0)
        )
          throw conflict();
        if (previous.state === "pending" && previous.leaseUntil <= now) {
          await refund(tx, previous, "lease_expired");
          return { state: "refunded" };
        }
        return stateOf(previous);
      }
      // Sous le même verrou que la réservation : les requêtes concurrentes ne
      // contournent pas ces bornes. Un rejeu connu ne consomme aucun nouvel essai.
      const pending = await tx.aiPlannerOperation.count({ where: { organizationId, state: "pending" } });
      const recent = await tx.aiPlannerOperation.count({
        where: { organizationId, actorId: userId, createdAt: { gt: new Date(now.getTime() - 60000) } },
      });
      if (pending >= 3 || recent >= 12) throw new AppError(429, "planner_rate_limited", m.aiPlanner.rateLimited);
      let month = monthAt(now, organization.timeZone);
      if (input.kind === "clarification") {
        const parent = await tx.aiPlannerProposal.findFirst({
          where: { id: input.proposalId, organizationId, actorId: userId, expiresAt: { gt: now } },
        });
        const paid = await tx.aiPlannerOperation.findUnique({ where: where(organizationId, input.proposalId) });
        if (
          !parent ||
          !paid ||
          paid.actorId !== userId ||
          paid.kind !== "proposal" ||
          paid.state !== "succeeded" ||
          parent.clarificationCount >= 5 ||
          !onClaim
        )
          throw conflict();
        month = paid.month;
      }
      const cost = {
        proposals: input.kind === "proposal" ? 1 : 0,
        audioSeconds: input.kind === "transcription" ? input.audioSeconds : 0,
      };
      const quota = await tx.aiPlannerQuota.upsert({
        where: { organizationId_month: { organizationId, month } },
        create: { organizationId, month },
        update: {},
      });
      if (
        input.kind !== "clarification" &&
        !plannerQuotaFits(
          organization.plan,
          {
            proposals: quota.usedProposals + quota.reservedProposals,
            audioSeconds: quota.usedAudioSeconds + quota.reservedAudioSeconds,
          },
          cost,
        )
      )
        throw new AppError(429, "planner_quota_exceeded", m.aiPlanner.quotaExceeded);
      const leaseToken = randomUUID();
      await onClaim?.(tx);
      const [year, monthNumber] = month.split("-").map(Number);
      // Tombstone technique jusqu’au neuvième jour du mois suivant ; aucun texte personnel.
      const expiresAt = new Date(Date.UTC(year!, monthNumber!, 9));
      await tx.aiPlannerOperation.create({
        data: {
          organizationId,
          id: input.id,
          actorId: userId,
          kind: input.kind,
          fingerprint: input.fingerprint,
          proposalId: input.kind === "clarification" ? input.proposalId : null,
          month,
          proposalCost: cost.proposals,
          audioSeconds: cost.audioSeconds,
          leaseToken,
          leaseUntil: new Date(now.getTime() + 5 * 60000),
          expiresAt,
          createdAt: now,
        },
      });
      await tx.aiPlannerQuota.update({
        where: { organizationId_month: { organizationId, month } },
        data: {
          reservedProposals: { increment: cost.proposals },
          reservedAudioSeconds: { increment: cost.audioSeconds },
        },
      });
      return { state: "claimed", leaseToken };
    },
    { timeout: 15000 },
  );
}

// Lecture sans consommation : les baux déjà expirés ne sont pas présentés comme
// des réservations actives, même si le cron ne les a pas encore restitués.
export async function getPlannerUsage(userId: string, organizationId: string, now = new Date()) {
  await requireOrgMember(userId, organizationId, "manageSessions");
  return prisma.$transaction(async (tx) => {
    await lock(tx, organizationId);
    await requireOrgMember(userId, organizationId, "manageSessions", tx);
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { aiPlannerEnabled: true, plan: true, timeZone: true },
    });
    if (!enabled(org)) throw disabled();
    const month = monthAt(now, org.timeZone);
    const quota = await tx.aiPlannerQuota.findUnique({ where: { organizationId_month: { organizationId, month } } });
    const pending = await tx.aiPlannerOperation.aggregate({
      where: { organizationId, month, state: "pending", leaseUntil: { gt: now } },
      _sum: { proposalCost: true, audioSeconds: true },
    });
    return plannerUsageResponse.parse({
      month,
      timeZone: org.timeZone,
      limit: plannerLimits(org.plan),
      used: { proposals: quota?.usedProposals ?? 0, audioSeconds: quota?.usedAudioSeconds ?? 0 },
      reserved: { proposals: pending._sum.proposalCost ?? 0, audioSeconds: pending._sum.audioSeconds ?? 0 },
    });
  });
}

// La création/mise à jour du résultat et la consommation sont dans la même transaction.
// Le callback ne doit faire que des écritures SQL, jamais un appel fournisseur.
export async function completePlannerOperation(
  userId: string,
  organizationId: string,
  id: string,
  leaseToken: string,
  commitResult: (tx: Prisma.TransactionClient) => Promise<PlannerResultReference>,
  now = new Date(),
): Promise<PlannerOperationClaim> {
  await requireOrgMember(userId, organizationId, "manageSessions");
  return prisma.$transaction(
    async (tx) => {
      await lock(tx, organizationId);
      await requireOrgMember(userId, organizationId, "manageSessions", tx);
      const row = await tx.aiPlannerOperation.findUnique({ where: where(organizationId, id) });
      if (!row) throw notFound();
      if (row.actorId !== userId) throw forbidden();
      if (row.state !== "pending") return stateOf(row);
      if (row.leaseToken !== leaseToken) throw conflict();
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { aiPlannerEnabled: true, plan: true },
      });
      if (row.leaseUntil <= now || !enabled(organization)) {
        await refund(tx, row, row.leaseUntil <= now ? "lease_expired" : "disabled");
        return { state: "refunded" };
      }
      const result = resultSchema.parse(await commitResult(tx));
      await tx.aiPlannerQuota.update({
        where: quotaWhere(row),
        data: {
          reservedProposals: { decrement: row.proposalCost },
          usedProposals: { increment: row.proposalCost },
          reservedAudioSeconds: { decrement: row.audioSeconds },
          usedAudioSeconds: { increment: row.audioSeconds },
        },
      });
      await tx.aiPlannerOperation.update({
        where: where(organizationId, id),
        data: { state: "succeeded", result, leaseToken: null },
      });
      return { state: "succeeded", result };
    },
    { timeout: 15000 },
  );
}

export async function failPlannerOperation(userId: string, organizationId: string, id: string, leaseToken: string) {
  await requireOrgMember(userId, organizationId, "manageSessions");
  return prisma.$transaction(async (tx) => {
    await lock(tx, organizationId);
    await requireOrgMember(userId, organizationId, "manageSessions", tx);
    const row = await tx.aiPlannerOperation.findUnique({ where: where(organizationId, id) });
    if (!row) throw notFound();
    if (row.actorId !== userId) throw forbidden();
    if (row.state !== "pending") return stateOf(row);
    if (row.leaseToken !== leaseToken) throw conflict();
    await refund(tx, row, "no_usable_result");
    return { state: "refunded" } as const;
  });
}

// Tâche interne appelée par le cron authentifié, même lorsque l’IA est désactivée.
export async function expirePlannerOperations(now = new Date()) {
  const due = await prisma.aiPlannerOperation.findMany({
    where: { state: "pending", leaseUntil: { lte: now } },
    select: { organizationId: true },
    distinct: ["organizationId"],
    take: 50,
  });
  let refunded = 0;
  for (const candidate of due) {
    refunded += await prisma.$transaction(async (tx) => {
      await lock(tx, candidate.organizationId);
      return refundExpired(tx, candidate.organizationId, now);
    });
  }
  const removed = await prisma.aiPlannerOperation.deleteMany({
    where: { state: { not: "pending" }, expiresAt: { lte: now } },
  });
  // Compteurs sans identité : deux mois civils au plus après leur mois d’usage.
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)).toISOString().slice(0, 7);
  await prisma.aiPlannerQuota.deleteMany({
    where: { month: { lt: cutoff }, reservedProposals: 0, reservedAudioSeconds: 0 },
  });
  return { refunded, removed: removed.count };
}
