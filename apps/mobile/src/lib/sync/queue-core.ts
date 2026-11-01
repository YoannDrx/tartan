import { ApiError } from "@tartan/api-client";
import type { AthleteSessionCard, AthleteToday, JumpAttemptInput, SessionLogInput } from "@tartan/contracts";

// Logique pure de la file hors ligne (§ 10.4). L'adaptateur natif est dans op-queue.ts ;
// ici tout se teste sans React Native.

export type LogOp = {
  id: string;
  kind: "log";
  orgId: string;
  sessionId: string;
  input: SessionLogInput;
  queuedAt: string;
};
export type AttendanceOp = {
  id: string;
  kind: "attendance";
  orgId: string;
  sessionId: string;
  status: "present" | "absent";
  queuedAt: string;
};
export type AttemptOp = {
  id: string;
  kind: "attempt";
  orgId: string;
  input: JumpAttemptInput;
  queuedAt: string;
};
export type QueuedOp = LogOp | AttendanceOp | AttemptOp;

// Une nouvelle validation ou présence pour la même séance remplace l'ancienne.
export const enqueue = (items: QueuedOp[], op: QueuedOp): QueuedOp[] => {
  if (op.kind === "attempt") return [...items, op];
  const others = items.filter((i) => !(i.kind === op.kind && i.orgId === op.orgId && i.sessionId === op.sessionId));
  return [...others, op];
};

// Pas de réseau, serveur occupé ou session expirée : on réessaiera. Un refus définitif, non.
export const isRetryable = (error: unknown): boolean => {
  if (!(error instanceof ApiError)) return true;
  return error.status >= 500 || error.status === 401 || error.status === 408 || error.status === 429;
};

export type ReplayResult = { sent: QueuedOp[]; rejected: QueuedOp[]; remaining: QueuedOp[] };

// Rejoue dans l'ordre et s'arrête à la première erreur temporaire. Un élément refusé
// définitivement ne bloque pas les suivants. Le clientId reste celui de la mise en file :
// si la réponse se perd, le serveur reconnaît le rejeu.
export const replay = async (items: QueuedOp[], send: (op: QueuedOp) => Promise<unknown>): Promise<ReplayResult> => {
  const sent: QueuedOp[] = [];
  const rejected: QueuedOp[] = [];
  let index = 0;
  for (const op of items) {
    try {
      // eslint-disable-next-line no-await-in-loop -- l'ordre d'envoi compte
      await send(op);
      sent.push(op);
    } catch (error) {
      if (isRetryable(error)) break;
      rejected.push(op);
    }
    index += 1;
  }
  return { sent, rejected, remaining: items.slice(index) };
};

export const pendingLogFor = (items: QueuedOp[], sessionId: string): LogOp | null =>
  items.find((i): i is LogOp => i.kind === "log" && i.sessionId === sessionId) ?? null;

export const pendingAttendanceFor = (items: QueuedOp[], sessionId: string): AttendanceOp | null =>
  items.find((i): i is AttendanceOp => i.kind === "attendance" && i.sessionId === sessionId) ?? null;

// Ce qui attend dans la file se voit déjà à l'écran : l'athlète n'a jamais à revalider.
export const applyPendingToCard = <T extends AthleteSessionCard>(card: T, items: QueuedOp[]): T => {
  const log = pendingLogFor(items, card.id);
  const attendance = pendingAttendanceFor(items, card.id);
  return {
    ...card,
    ...(log ? { status: log.input.status, variant: log.input.variantDone } : {}),
    ...(attendance
      ? {
          attendance: attendance.status,
          ...(!log && card.hasAutonomous
            ? { variant: attendance.status === "absent" ? ("autonomous" as const) : ("club" as const) }
            : {}),
        }
      : {}),
  };
};

export const applyPendingToToday = (today: AthleteToday, items: QueuedOp[], date: string): AthleteToday => {
  const cards = today.today.map((c) => applyPendingToCard(c, items));
  return {
    ...today,
    today: cards,
    next: today.next ? applyPendingToCard(today.next, items) : null,
    week: today.week.map((d) => {
      if (d.date !== date || cards.length === 0) return d;
      if (cards.every((c) => c.status === "done")) return { ...d, status: "done" as const };
      return d;
    }),
  };
};

export type KeyValueStore = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

// Le trousseau ne garantit que 2 048 octets par entrée : on échappe en ASCII et on découpe.
export const toAsciiJson = (value: unknown): string =>
  JSON.stringify(value).replace(/[^\x20-\x7e]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);

export const createChunkedStore = (store: KeyValueStore, chunkSize = 1800) => {
  const countKey = (key: string) => `${key}.count`;
  const chunkKey = (key: string, i: number) => `${key}.${i}`;
  const readCount = async (key: string) => {
    const raw = await store.get(countKey(key));
    const count = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
  };
  return {
    read: async (key: string): Promise<string | null> => {
      const count = await readCount(key);
      if (count === 0) return null;
      let value = "";
      for (let i = 0; i < count; i += 1) {
        // eslint-disable-next-line no-await-in-loop -- morceaux lus dans l'ordre
        const chunk = await store.get(chunkKey(key, i));
        if (chunk === null) return null;
        value += chunk;
      }
      return value;
    },
    write: async (key: string, value: string): Promise<void> => {
      const previous = await readCount(key);
      const chunks: string[] = [];
      for (let start = 0; start < value.length; start += chunkSize) chunks.push(value.slice(start, start + chunkSize));
      for (const [i, chunk] of chunks.entries()) {
        // eslint-disable-next-line no-await-in-loop -- morceaux écrits dans l'ordre
        await store.set(chunkKey(key, i), chunk);
      }
      await store.set(countKey(key), String(chunks.length));
      for (let i = chunks.length; i < previous; i += 1) {
        // eslint-disable-next-line no-await-in-loop -- nettoyage séquentiel
        await store.remove(chunkKey(key, i));
      }
    },
    remove: async (key: string): Promise<void> => {
      const count = await readCount(key);
      for (let i = 0; i < count; i += 1) {
        // eslint-disable-next-line no-await-in-loop -- nettoyage séquentiel
        await store.remove(chunkKey(key, i));
      }
      await store.remove(countKey(key));
    },
  };
};

export const parseQueue = (raw: string | null): QueuedOp[] => {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is QueuedOp => {
      if (typeof item !== "object" || item === null) return false;
      const op = item as Record<string, unknown>;
      return (
        typeof op.id === "string" &&
        typeof op.orgId === "string" &&
        (op.kind === "log" || op.kind === "attendance" || op.kind === "attempt")
      );
    });
  } catch {
    return [];
  }
};
