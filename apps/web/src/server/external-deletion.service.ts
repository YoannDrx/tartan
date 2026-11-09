import { randomUUID } from "node:crypto";
import { del } from "@vercel/blob";
import type { Prisma } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { cancelUpload, deleteAsset, listAssets, videoEnabled } from "@/lib/mux";
import { prisma } from "@/lib/prisma";
import { billingEnabled, stripe } from "@/lib/stripe";

export type ExternalProvider = "mux_asset" | "mux_upload" | "blob" | "stripe_subscription" | "stripe_customer";

const BATCH = 100;
const LEASE_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 14;
const HOUR_MS = 60 * 60 * 1000;
const RECONCILE_AGE_MS = 48 * HOUR_MS;
const PASSTHROUGH = /^(video|exercise):([0-9a-f-]{36})$/;

class ProviderUnconfigured extends Error {}

// Mux écrit `status`, Stripe `statusCode`.
const httpStatus = (error: unknown): number | null => {
  if (typeof error !== "object" || error === null) return null;
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  return typeof status === "number" ? status : typeof statusCode === "number" ? statusCode : null;
};

const isNotFound = (error: unknown): boolean => httpStatus(error) === 404;

const errorCode = (error: unknown): string => {
  if (error instanceof ProviderUnconfigured) return "provider_unconfigured";
  const status = httpStatus(error);
  if (status !== null) return `http_${status}`;
  return "provider_error";
};

const remove = async (provider: string, ref: string): Promise<void> => {
  switch (provider) {
    case "mux_asset":
      if (!videoEnabled()) throw new ProviderUnconfigured();
      return deleteAsset(ref);
    case "mux_upload":
      if (!videoEnabled()) throw new ProviderUnconfigured();
      return cancelUpload(ref);
    case "blob":
      if (!env().BLOB_READ_WRITE_TOKEN) throw new ProviderUnconfigured();
      return del(ref, { token: env().BLOB_READ_WRITE_TOKEN });
    case "stripe_subscription":
      if (!billingEnabled()) throw new ProviderUnconfigured();
      await stripe().subscriptions.cancel(ref);
      return;
    case "stripe_customer":
      if (!billingEnabled()) throw new ProviderUnconfigured();
      await stripe().customers.del(ref);
      return;
    default:
      throw new Error("unknown_provider");
  }
};

// Mise en file : les triggers SQL couvrent les suppressions en base, ceci couvre le reste.
export const enqueueExternalDeletion = async (
  input: {
    provider: ExternalProvider;
    ref: string;
    reason: string;
    notBefore?: Date;
  },
  db: Pick<Prisma.TransactionClient, "externalDeletion"> = prisma,
): Promise<void> => {
  const data = {
    reason: input.reason,
    notBefore: input.notBefore ?? new Date(),
    state: "pending",
    attempts: 0,
    nextAttemptAt: input.notBefore ?? new Date(),
    lastErrorCode: null,
    completedAt: null,
  };
  await db.externalDeletion.upsert({
    where: { provider_externalRef: { provider: input.provider, externalRef: input.ref } },
    create: { ...data, provider: input.provider, externalRef: input.ref },
    update: data,
  });
};

// Un nouvel accord annule un effacement différé qui n'a pas encore eu lieu.
export const cancelExternalDeletion = async (provider: ExternalProvider, ref: string): Promise<void> => {
  await prisma.externalDeletion.updateMany({
    where: { provider, externalRef: ref, state: "pending" },
    data: { state: "cancelled" },
  });
};

const nextDelayMs = (attempts: number): number => Math.min(24 * 60, 2 ** attempts) * 60 * 1000;

export const processExternalDeletions = async (now: Date = new Date(), ids?: string[]): Promise<number> => {
  // Une préversion n'efface rien chez un prestataire : elle peut partager un jeton avec la production.
  if (process.env.VERCEL_ENV === "preview") return 0;
  const due = await prisma.externalDeletion.findMany({
    where: {
      state: "pending",
      notBefore: { lte: now },
      nextAttemptAt: { lte: now },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      ...(ids ? { id: { in: ids } } : {}),
    },
    orderBy: { nextAttemptAt: "asc" },
    take: BATCH,
  });
  let done = 0;
  for (const row of due) {
    const leaseToken = randomUUID();
    // Le bail empêche deux exécutions concurrentes d'appeler deux fois le prestataire.
    const claimed = await prisma.externalDeletion.updateMany({
      where: { id: row.id, state: "pending", OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
      data: { leaseToken, leaseUntil: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      await remove(row.provider, row.externalRef).catch((error: unknown) => {
        if (!isNotFound(error)) throw error;
      });
      await prisma.externalDeletion.updateMany({
        where: { id: row.id, leaseToken },
        data: { state: "done", completedAt: now, leaseToken: null, leaseUntil: null, lastErrorCode: null },
      });
      done += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      const code = errorCode(error);
      await prisma.externalDeletion.updateMany({
        where: { id: row.id, leaseToken },
        data: {
          state: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          nextAttemptAt: new Date(now.getTime() + nextDelayMs(attempts)),
          leaseToken: null,
          leaseUntil: null,
          lastErrorCode: code,
        },
      });
      log.warn("external_deletion_failed", { code, entityId: row.id });
    }
  }
  return done;
};

// Après une suppression : tout de suite si possible, sinon la tâche horaire reprendra.
export const drainExternalDeletions = async (): Promise<void> => {
  await processExternalDeletions().catch(() => log.warn("external_deletion_drain_failed"));
};

export const externalDeletionHealth = async (now: Date = new Date()) => {
  const [failed, overdue] = await Promise.all([
    prisma.externalDeletion.count({ where: { state: "failed" } }),
    prisma.externalDeletion.count({
      where: { state: "pending", notBefore: { lte: new Date(now.getTime() - 24 * HOUR_MS) } },
    }),
  ]);
  return { failed, overdue };
};

// Rapprochement quotidien : un fichier chez Mux sans ligne en base est un oubli à effacer.
// Simulation par défaut. Sans passthrough reconnu : alerte, jamais de suppression.
export const reconcileExternalAssets = async (now: Date = new Date()) => {
  const result = { orphans: 0, unknown: 0, enqueued: 0 };
  if (!videoEnabled() || process.env.VERCEL_ENV !== "production") return result;
  const apply = process.env.RECONCILE_APPLY === "true";
  for await (const asset of listAssets()) {
    const match = PASSTHROUGH.exec(asset.passthrough ?? "");
    if (!match) {
      result.unknown += 1;
      continue;
    }
    if (now.getTime() - asset.createdAt.getTime() < RECONCILE_AGE_MS) continue;
    const [, kind, id] = match;
    const exists =
      kind === "video"
        ? await prisma.video.count({ where: { id } })
        : await prisma.exerciseMedia.count({ where: { id } });
    if (exists) continue;
    result.orphans += 1;
    if (apply) {
      await enqueueExternalDeletion({ provider: "mux_asset", ref: asset.id, reason: "reconcile_orphan" });
      result.enqueued += 1;
    }
  }
  if (result.orphans || result.unknown) log.warn("external_reconcile", { count: result.orphans + result.unknown });
  return result;
};
