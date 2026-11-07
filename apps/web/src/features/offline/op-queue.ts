"use client";

import { m } from "@tartan/i18n";
import { idbAll, idbDelete, idbPut } from "./idb";

export type OpKind = "log" | "attendance" | "rollCall" | "attempt" | "comment";

// Réseau médiocre au stade : l'action est gardée sur l'appareil, par compte, et rejouée au retour du réseau.
export type QueuedOp = {
  id: string;
  ownerId: string;
  kind: OpKind;
  // Séance ou fil visé : l'écran rouvert hors ligne sait ce qui attend.
  target: string;
  path: string;
  body: unknown;
  createdAt: number;
  blocked?: { status: number };
};

export type SendResult =
  | { state: "sent"; data: unknown }
  | { state: "queued"; reason: "offline" | "session" }
  | { state: "error"; message: string };

export const QUEUE_EVENT = "tartan:queue";

let owner: string | null = null;
let flushing = false;
let sessionExpired = false;
let ownerGeneration = 0;
let lastQueuedAt = 0;
const submissions = new Map<string, Promise<SendResult>>();

export const setQueueOwner = (userId: string) => {
  if (owner !== userId) {
    ownerGeneration += 1;
    sessionExpired = false;
  }
  owner = userId;
};

export const isSessionExpired = () => sessionExpired;

const announce = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT));
};

// Session expirée, trop de requêtes, serveur en panne : l'action attend, elle n'est jamais perdue.
const isRetryable = (status: number): boolean => status === 401 || status === 408 || status === 429 || status >= 500;

const isVersionedLog = (op: Pick<QueuedOp, "kind" | "body">): boolean => {
  const body = op.body as { expectedVersion?: number; detailedSets?: unknown } | null;
  return op.kind === "log" && (body?.expectedVersion !== undefined || body?.detailedSets !== undefined);
};

// Le chemin contient l'espace ; une autre organisation ne partage pas ce blocage.
const targetKey = (op: QueuedOp): string => `${op.path.split("/sessions/")[0]}:${op.target}`;

export const reviewRequiredOps = (ops: QueuedOp[]): QueuedOp[] => {
  const targets = new Set(ops.filter((op) => op.blocked).map(targetKey));
  return ops.filter((op) => targets.has(targetKey(op)));
};

const post = (op: Pick<QueuedOp, "path" | "body">): Promise<Response> =>
  fetch(`/api/v1${op.path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(op.body),
  });

const remember = async (op: QueuedOp): Promise<boolean> => {
  try {
    await idbPut("ops", op);
    announce();
    return true;
  } catch {
    return false;
  }
};

export const pendingOps = async (): Promise<QueuedOp[]> => {
  const userId = owner;
  try {
    const all = await idbAll<QueuedOp>("ops");
    return all.filter((op) => op.ownerId === userId).sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
};

const submit = async (op: Pick<QueuedOp, "id" | "kind" | "target" | "path" | "body">): Promise<SendResult> => {
  if (!owner) return { state: "error", message: m.offline.session };
  const generation = ownerGeneration;
  lastQueuedAt = Math.max(Date.now(), lastQueuedAt + 1);
  const queued: QueuedOp = { ...op, ownerId: owner, createdAt: lastQueuedAt };
  const keep = async (reason: "offline" | "session"): Promise<SendResult> =>
    (await remember(queued)) ? { state: "queued", reason } : { state: "error", message: m.offline.noStorage };
  const previous = await pendingOps();
  const existing = previous.find((item) => item.id === op.id);
  if (existing?.blocked) return { state: "error", message: m.offline.needsReview };
  if (existing) return { state: "queued", reason: "offline" };
  if (previous.some((item) => item.blocked && targetKey(item) === targetKey(queued))) {
    if (!(await remember(queued))) return { state: "error", message: m.offline.noStorage };
    return { state: "error", message: m.offline.needsReview };
  }
  if (generation !== ownerGeneration) return keep("session");
  // Une saisie détaillée survit aussi à une fermeture pendant l'appel réseau.
  const durable = isVersionedLog(queued);
  if (durable) {
    if (!(await remember(queued))) return { state: "error", message: m.offline.noStorage };
    if (generation !== ownerGeneration || previous.some((item) => targetKey(item) === targetKey(queued))) {
      return { state: "queued", reason: "offline" };
    }
  }
  let res: Response;
  try {
    res = await post(op);
  } catch {
    return keep("offline");
  }
  if (res.ok) {
    if (durable) await idbDelete("ops", op.id);
    announce();
    return { state: "sent", data: await res.json().catch(() => null) };
  }
  if (res.status === 401) {
    if (generation === ownerGeneration) sessionExpired = true;
    return keep("session");
  }
  if (isRetryable(res.status)) return keep("offline");
  if (res.status === 409 || durable) {
    if (!(await remember({ ...queued, blocked: { status: res.status } }))) {
      return { state: "error", message: m.offline.noStorage };
    }
    return { state: "error", message: m.offline.needsReview };
  }
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return { state: "error", message: body?.message ?? m.common.genericError };
};

export const submitOp = (op: Pick<QueuedOp, "id" | "kind" | "target" | "path" | "body">): Promise<SendResult> => {
  const key = `${owner}:${op.id}`;
  const current = submissions.get(key);
  if (current) return current;
  const request = submit(op).finally(() => submissions.delete(key));
  submissions.set(key, request);
  return request;
};

export type FlushResult = { sent: number; rejected: number };

export const flushOps = async (): Promise<FlushResult> => {
  const result: FlushResult = { sent: 0, rejected: 0 };
  if (flushing) return result;
  const generation = ownerGeneration;
  flushing = true;
  try {
    // Dans l'ordre : présence avant validation, par exemple.
    const ops = await pendingOps();
    const blockedTargets = new Set(ops.filter((op) => op.blocked).map(targetKey));
    for (const op of ops) {
      if (generation !== ownerGeneration) break;
      if (submissions.has(`${op.ownerId}:${op.id}`)) {
        blockedTargets.add(targetKey(op));
        continue;
      }
      if (op.blocked || blockedTargets.has(targetKey(op))) continue;
      let res: Response;
      try {
        res = await post(op);
      } catch {
        break;
      }
      if (res.status === 401) {
        if (generation === ownerGeneration) sessionExpired = true;
        break;
      }
      if (generation === ownerGeneration) sessionExpired = false;
      if (isRetryable(res.status)) break;
      if (!res.ok && (res.status === 409 || isVersionedLog(op))) {
        if (!(await remember({ ...op, blocked: { status: res.status } }))) break;
        blockedTargets.add(targetKey(op));
        continue;
      }
      if (res.ok) result.sent += 1;
      else result.rejected += 1;
      await idbDelete("ops", op.id);
    }
  } finally {
    flushing = false;
    announce();
  }
  return result;
};
