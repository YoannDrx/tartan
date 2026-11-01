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
};

export type SendResult =
  | { state: "sent"; data: unknown }
  | { state: "queued"; reason: "offline" | "session" }
  | { state: "error"; message: string };

export const QUEUE_EVENT = "tartan:queue";

let owner: string | null = null;
let flushing = false;
let sessionExpired = false;

export const setQueueOwner = (userId: string) => {
  owner = userId;
};

export const isSessionExpired = () => sessionExpired;

const announce = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT));
};

// Session expirée, trop de requêtes, serveur en panne : l'action attend, elle n'est jamais perdue.
const isRetryable = (status: number): boolean => status === 401 || status === 408 || status === 429 || status >= 500;

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
  try {
    const all = await idbAll<QueuedOp>("ops");
    return all.filter((op) => op.ownerId === owner).sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
};

export const submitOp = async (op: Pick<QueuedOp, "id" | "kind" | "target" | "path" | "body">): Promise<SendResult> => {
  const queued: QueuedOp = { ...op, ownerId: owner ?? "", createdAt: Date.now() };
  const keep = async (reason: "offline" | "session"): Promise<SendResult> =>
    (await remember(queued)) ? { state: "queued", reason } : { state: "error", message: m.offline.noStorage };
  let res: Response;
  try {
    res = await post(op);
  } catch {
    return keep("offline");
  }
  if (res.ok) return { state: "sent", data: await res.json().catch(() => null) };
  if (res.status === 401) {
    sessionExpired = true;
    return keep("session");
  }
  if (isRetryable(res.status)) return keep("offline");
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return { state: "error", message: body?.message ?? m.common.genericError };
};

export type FlushResult = { sent: number; rejected: number };

export const flushOps = async (): Promise<FlushResult> => {
  const result: FlushResult = { sent: 0, rejected: 0 };
  if (flushing) return result;
  flushing = true;
  try {
    // Dans l'ordre : présence avant validation, par exemple.
    for (const op of await pendingOps()) {
      let res: Response;
      try {
        res = await post(op);
      } catch {
        break;
      }
      if (res.status === 401) {
        sessionExpired = true;
        break;
      }
      sessionExpired = false;
      if (isRetryable(res.status)) break;
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
