"use client";

import type { SessionLogInput } from "@tartan/contracts";
import { m } from "@tartan/i18n";

type Pending = { organizationId: string; sessionId: string; input: SessionLogInput };

const KEY = "tartan.validations";

const read = (): Pending[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Pending[];
  } catch {
    return [];
  }
};

const write = (items: Pending[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Stockage indisponible (navigation privée) : la validation reste à refaire.
  }
};

const post = async ({ organizationId, sessionId, input }: Pending): Promise<Response> =>
  fetch(`/api/v1/orgs/${organizationId}/sessions/${sessionId}/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

// Session expirée, trop de requêtes, serveur en panne : la validation attend, elle n'est jamais perdue.
const isRetryable = (status: number): boolean => status === 401 || status === 408 || status === 429 || status >= 500;

const remember = (pending: Pending) =>
  write([...read().filter((p) => p.input.clientId !== pending.input.clientId), pending]);

export type SendResult = { state: "sent" } | { state: "queued" } | { state: "error"; message: string };

// Réseau médiocre au stade : on garde la validation et on la rejoue au retour de la connexion.
export const sendValidation = async (pending: Pending): Promise<SendResult> => {
  try {
    const res = await post(pending);
    if (res.ok) return { state: "sent" };
    if (isRetryable(res.status)) {
      remember(pending);
      return res.status === 401 ? { state: "error", message: m.errors.unauthorized } : { state: "queued" };
    }
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return { state: "error", message: body?.message ?? m.common.genericError };
  } catch {
    remember(pending);
    return { state: "queued" };
  }
};

export const flushValidations = async (): Promise<number> => {
  const items = read();
  let sent = 0;
  const remaining: Pending[] = [];
  for (const item of items) {
    try {
      const res = await post(item);
      if (isRetryable(res.status)) remaining.push(item);
      else sent += 1;
    } catch {
      remaining.push(item);
    }
  }
  write(remaining);
  return sent;
};

export const newClientId = (): string => crypto.randomUUID();
