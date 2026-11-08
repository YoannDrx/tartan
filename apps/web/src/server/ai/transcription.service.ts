import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import {
  createPlannerTranscriptionInput,
  plannerTranscriptionResponse,
  type CreatePlannerTranscriptionInput,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { AppError, forbidden, notFound } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";
import { requireOrgMember } from "../access";
import { inspectPlannerAudio } from "./audio";
import { completePlannerOperation, failPlannerOperation, reservePlannerOperation } from "./usage.service";
import { openAiTranscriptionProvider, type PlannerTranscriptionProvider } from "./transcription-provider";

const expired = () => new AppError(410, "planner_expired", m.aiPlanner.expiredRequest);
export async function requirePlannerTranscriptionAccess(
  userId: string,
  organizationId: string,
  db: Prisma.TransactionClient = prisma,
) {
  await requireOrgMember(userId, organizationId, "manageSessions", db);
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { aiPlannerEnabled: true, plan: true },
  });
  if (env().AI_PLANNER_ENABLED !== "true" || !org.aiPlannerEnabled || org.plan === "discovery")
    throw new AppError(403, "planner_disabled", m.aiPlanner.disabled);
}
async function owned(
  userId: string,
  organizationId: string,
  id: string,
  now: Date,
  db: Prisma.TransactionClient = prisma,
) {
  const row = await db.aiPlannerTranscription.findFirst({ where: { id, organizationId } });
  if (!row) throw notFound();
  if (row.actorId !== userId) throw forbidden();
  if (row.expiresAt <= now) throw expired();
  return row;
}
export async function getPlannerTranscription(userId: string, organizationId: string, id: string, now = new Date()) {
  await requirePlannerTranscriptionAccess(userId, organizationId);
  const row = await owned(userId, organizationId, id, now);
  let state = row.state;
  if (state === "processing") {
    const operation = await prisma.aiPlannerOperation.findUnique({
      where: { organizationId_id: { organizationId, id } },
    });
    if (operation?.state !== "pending" || operation.leaseUntil <= now) state = "failed";
  }
  return plannerTranscriptionResponse.parse({
    id: row.id,
    version: row.version,
    state,
    text: row.text,
    audioSeconds: row.audioSeconds,
    expiresAt: row.expiresAt.toISOString(),
  });
}

export async function transcribePlannerAudio(
  userId: string,
  organizationId: string,
  raw: CreatePlannerTranscriptionInput,
  bytes: Uint8Array<ArrayBuffer>,
  execution: { provider?: PlannerTranscriptionProvider; clock?: () => Date } = {},
) {
  const input = createPlannerTranscriptionInput.parse(raw),
    clock = execution.clock ?? (() => new Date()),
    now = clock();
  await requirePlannerTranscriptionAccess(userId, organizationId);
  const requestedAt = new Date(input.requestedAt);
  if (requestedAt.getTime() > now.getTime() + 5 * 60000 || requestedAt.getTime() + 86400000 <= now.getTime())
    throw expired();
  const audio = await inspectPlannerAudio(bytes);
  const fingerprint = createHmac("sha256", env().BETTER_AUTH_SECRET)
    .update("tartan-audio-v1\n")
    .update(JSON.stringify(input))
    .update(bytes)
    .digest("hex");
  const claim = await reservePlannerOperation(
    userId,
    organizationId,
    {
      id: input.id,
      kind: "transcription",
      fingerprint,
      audioSeconds: audio.audioSeconds,
    },
    now,
    async (tx) => {
      await requirePlannerTranscriptionAccess(userId, organizationId, tx);
      if (await tx.aiPlannerTranscription.findUnique({ where: { id: input.id }, select: { id: true } }))
        throw new AppError(409, "planner_request_conflict", m.aiPlanner.requestConflict);
      await tx.aiPlannerTranscription.create({
        data: {
          id: input.id,
          organizationId,
          actorId: userId,
          audioSeconds: audio.audioSeconds,
          expiresAt: new Date(Math.min(now.getTime(), requestedAt.getTime()) + 86400000),
          createdAt: now,
        },
      });
    },
  );
  if (claim.state !== "claimed") return getPlannerTranscription(userId, organizationId, input.id, clock());
  try {
    // Aucun verrou ni fichier temporaire pendant le transfert au prestataire.
    const text = z
      .string()
      .trim()
      .min(1)
      .max(12000)
      .parse(await (execution.provider ?? openAiTranscriptionProvider()).transcribe(audio));
    const complete = await completePlannerOperation(
      userId,
      organizationId,
      input.id,
      claim.leaseToken,
      async (tx) => {
        await requirePlannerTranscriptionAccess(userId, organizationId, tx);
        const row = await owned(userId, organizationId, input.id, clock(), tx);
        if (row.state !== "processing")
          throw new AppError(409, "planner_request_conflict", m.aiPlanner.requestConflict);
        const saved = await tx.aiPlannerTranscription.update({
          where: { id: row.id },
          data: { text, state: "ready", version: { increment: 1 } },
        });
        return { transcriptionId: saved.id, version: saved.version };
      },
      clock(),
    );
    if (complete.state === "refunded") throw new Error("planner_transcription_expired");
  } catch (error) {
    const settled = await failPlannerOperation(userId, organizationId, input.id, claim.leaseToken).catch(() => null);
    if (settled?.state === "succeeded") return getPlannerTranscription(userId, organizationId, input.id, clock());
    if (settled?.state === "refunded")
      await prisma.aiPlannerTranscription.updateMany({
        where: { id: input.id, organizationId, actorId: userId, state: "processing" },
        data: { state: "failed" },
      });
    if (error instanceof AppError) throw error;
    throw new AppError(502, "planner_transcription_failed", m.aiPlanner.transcriptionFailed);
  }
  return getPlannerTranscription(userId, organizationId, input.id, clock());
}

// Le brut ASR expire sous 24 heures même si aucune proposition n’est créée.
// Le texte corrigé/relu est ensuite soumis au cycle propre de la proposition.
export async function purgePlannerTranscriptions(now = new Date()) {
  const due = await prisma.aiPlannerTranscription.findMany({
    where: { expiresAt: { lte: now } },
    select: { organizationId: true },
    distinct: ["organizationId"],
    take: 50,
  });
  let removed = 0;
  for (const row of due)
    removed += await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${row.organizationId}::uuid FOR UPDATE`;
      return (
        await tx.aiPlannerTranscription.deleteMany({
          where: { organizationId: row.organizationId, expiresAt: { lte: now } },
        })
      ).count;
    });
  return { removed };
}
