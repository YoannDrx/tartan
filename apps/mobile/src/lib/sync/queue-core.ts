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
export type QueuedOp = (LogOp | AttendanceOp | AttemptOp) & {
  // Le contenu reste dans le trousseau ; aucun message serveur potentiellement sensible.
  blocked?: { status: number };
};

export const isVersionedLog = (op: QueuedOp): boolean =>
  op.kind === "log" && (op.input.expectedVersion !== undefined || op.input.detailedSets !== undefined);

const targetKey = (op: QueuedOp): string =>
  `${op.orgId}:${op.kind === "attempt" ? `attempt:${op.id}` : `session:${op.sessionId}`}`;

export const reviewRequiredOps = (ops: QueuedOp[]): QueuedOp[] => {
  const targets = new Set(ops.filter((op) => op.blocked).map(targetKey));
  return ops.filter((op) => targets.has(targetKey(op)));
};

// Seules les anciennes validations simples et présences peuvent être remplacées.
export const enqueue = (items: QueuedOp[], op: QueuedOp): QueuedOp[] => {
  // Le même identifiant désigne une mutation immuable, même après une réponse perdue.
  if (items.some((i) => i.id === op.id)) return items;
  if (op.kind === "attempt") return [...items, op];
  const others = items.filter(
    (i) =>
      i.blocked ||
      isVersionedLog(i) ||
      isVersionedLog(op) ||
      !(i.kind === op.kind && i.orgId === op.orgId && i.sessionId === op.sessionId),
  );
  return [...others, op];
};

// Pas de réseau, serveur occupé ou session expirée : on réessaiera. Un refus définitif, non.
export const isRetryable = (error: unknown): boolean => {
  if (!(error instanceof ApiError)) return true;
  return error.status >= 500 || error.status === 401 || error.status === 408 || error.status === 429;
};

export type ReplayResult = { sent: QueuedOp[]; rejected: QueuedOp[]; remaining: QueuedOp[] };

// Rejoue dans l'ordre et s'arrête à la première erreur temporaire. Un conflit retient
// sa séance, sans bloquer les autres. Le clientId reste celui de la mise en file :
// si la réponse se perd, le serveur reconnaît le rejeu.
export const replay = async (
  items: QueuedOp[],
  send: (op: QueuedOp) => Promise<unknown>,
  isCurrentOwner: () => boolean = () => true,
): Promise<ReplayResult> => {
  const sent: QueuedOp[] = [];
  const rejected: QueuedOp[] = [];
  const remaining: QueuedOp[] = [];
  const blockedTargets = new Set(items.filter((op) => op.blocked).map(targetKey));
  for (const [index, op] of items.entries()) {
    if (!isCurrentOwner()) {
      remaining.push(...items.slice(index));
      break;
    }
    if (op.blocked || blockedTargets.has(targetKey(op))) {
      remaining.push(op);
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop -- l'ordre d'envoi compte
      await send(op);
      sent.push(op);
    } catch (error) {
      if (isRetryable(error)) {
        remaining.push(...items.slice(index));
        break;
      }
      if (error instanceof ApiError && (error.status === 409 || isVersionedLog(op))) {
        remaining.push({ ...op, blocked: { status: error.status } });
        blockedTargets.add(targetKey(op));
      } else rejected.push(op);
    }
  }
  return { sent, rejected, remaining };
};

export const pendingLogFor = (items: QueuedOp[], sessionId: string): LogOp | null =>
  items.some((i) => i.blocked && i.kind !== "attempt" && i.sessionId === sessionId)
    ? null
    : (items.findLast((i): i is LogOp => i.kind === "log" && i.sessionId === sessionId) ?? null);

export const pendingAttendanceFor = (items: QueuedOp[], sessionId: string): AttendanceOp | null =>
  items.some((i) => i.blocked && i.kind !== "attempt" && i.sessionId === sessionId)
    ? null
    : (items.findLast((i): i is AttendanceOp => i.kind === "attendance" && i.sessionId === sessionId) ?? null);

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
  type Head = { generation: string | null; count: number };
  const locks = new Map<string, Promise<unknown>>();
  const serial = <T>(key: string, run: () => Promise<T>): Promise<T> => {
    const next = (locks.get(key) ?? Promise.resolve()).catch(() => undefined).then(run);
    locks.set(key, next);
    void next
      .finally(() => {
        if (locks.get(key) === next) locks.delete(key);
      })
      .catch(() => undefined);
    return next;
  };
  const chunkKey = (key: string, head: Head, i: number) =>
    head.generation ? `${key}.v2.${head.generation}.${i}` : `${key}.${i}`;
  const readHead = async (key: string): Promise<Head> => {
    const raw = await store.get(`${key}.head`);
    if (raw !== null) {
      const head = JSON.parse(raw) as Head;
      if (
        typeof head.generation !== "string" ||
        !/^[a-z0-9-]+$/.test(head.generation) ||
        !Number.isInteger(head.count) ||
        head.count < 0 ||
        head.count > 100_000
      ) {
        throw new Error("QUEUE_STORAGE_CORRUPTED");
      }
      return head;
    }
    // Compatibilité avec les applications déjà installées.
    const count = Number((await store.get(`${key}.count`)) ?? 0);
    if (!Number.isInteger(count) || count < 0 || count > 100_000) throw new Error("QUEUE_STORAGE_CORRUPTED");
    return { generation: null, count };
  };
  const clean = async (key: string, head: Head) => {
    for (let i = 0; i < head.count; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- nettoyage des morceaux après commit
      await store.remove(chunkKey(key, head, i));
    }
    if (head.generation === null) await store.remove(`${key}.count`);
  };
  const replace = async (key: string, value: string) => {
    const previous = await readHead(key);
    const head: Head = {
      generation: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      count: Math.ceil(value.length / chunkSize),
    };
    try {
      for (let i = 0; i < head.count; i += 1) {
        // eslint-disable-next-line no-await-in-loop -- la tête bascule seulement après le dernier morceau
        await store.set(chunkKey(key, head, i), value.slice(i * chunkSize, (i + 1) * chunkSize));
      }
      await store.set(`${key}.head`, JSON.stringify(head));
    } catch (error) {
      await clean(key, head).catch(() => undefined);
      throw error;
    }
    // Un nettoyage interrompu ne rend pas invalide la nouvelle valeur déjà enregistrée.
    await clean(key, previous).catch(() => undefined);
  };
  return {
    read: (key: string): Promise<string | null> =>
      serial(key, async () => {
        const head = await readHead(key);
        if (head.count === 0) return null;
        let value = "";
        for (let i = 0; i < head.count; i += 1) {
          // eslint-disable-next-line no-await-in-loop -- lecture cohérente de la génération choisie
          const chunk = await store.get(chunkKey(key, head, i));
          if (chunk === null) throw new Error("QUEUE_STORAGE_CORRUPTED");
          value += chunk;
        }
        return value;
      }),
    write: (key: string, value: string): Promise<void> => serial(key, () => replace(key, value)),
    // Une tête vide empêche de ressusciter les anciens morceaux si le nettoyage est interrompu.
    remove: (key: string): Promise<void> => serial(key, () => replace(key, "")),
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
