import type { JumpAttemptInput, SessionLogInput } from "@tartan/contracts";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { api } from "../api";
import { queryClient } from "../query-client";
import {
  createChunkedStore,
  enqueue,
  parseQueue,
  replay,
  reviewRequiredOps,
  toAsciiJson,
  type KeyValueStore,
  type QueuedOp,
} from "./queue-core";

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const backend: KeyValueStore = {
  get: (key) => SecureStore.getItemAsync(key, secureOptions),
  set: (key, value) => SecureStore.setItemAsync(key, value, secureOptions),
  remove: (key) => SecureStore.deleteItemAsync(key, secureOptions),
};

// La file porte effort ressenti et douleur : elle va dans le trousseau, par compte.
const chunked = createChunkedStore(backend);
const keyFor = (ownerId: string) => `tartan.op-queue.${ownerId.replace(/[^A-Za-z0-9._-]/g, "")}`;

const send = (op: QueuedOp): Promise<unknown> => {
  switch (op.kind) {
    case "log":
      return api.logSession(op.orgId, op.sessionId, op.input);
    case "attendance":
      return api.setAttendance(op.orgId, op.sessionId, op.status);
    case "attempt":
      return api.addJumpAttempt(op.orgId, op.input);
  }
};

const RETRY_MS = 30_000;
const LAST_OWNER_KEY = "tartan.last-owner";
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let ownerGeneration = 0;
// SecureStore écrit plusieurs morceaux : les sauvegardes ne doivent pas s'entrelacer.
let persistence: Promise<void> = Promise.resolve();

type OpQueueState = {
  ownerId: string | null;
  items: QueuedOp[];
  syncing: boolean;
  rejectedCount: number;
  storageError: boolean;
  hydrate: (ownerId: string) => Promise<void>;
  detach: () => Promise<void>;
  add: (op: QueuedOp) => Promise<void>;
  flush: () => Promise<void>;
  dismissRejected: () => void;
};

const save = (ownerId: string, items: QueuedOp[]): Promise<void> => {
  const next = persistence
    .catch(() => undefined)
    .then(async () => {
      if (items.length === 0) await chunked.remove(keyFor(ownerId));
      else await chunked.write(keyFor(ownerId), toAsciiJson(items));
    });
  persistence = next;
  return next;
};

export const useOpQueue = create<OpQueueState>((set, get) => ({
  ownerId: null,
  items: [],
  syncing: false,
  rejectedCount: 0,
  storageError: false,
  hydrate: async (ownerId) => {
    if (get().ownerId === ownerId) return;
    const generation = ++ownerGeneration;
    set({ ownerId: null, items: [], rejectedCount: 0, storageError: false });
    await persistence.catch(() => undefined);
    const items = parseQueue(await chunked.read(keyFor(ownerId)));
    if (generation !== ownerGeneration) return;
    set({ ownerId, items });
    // La tâche d'arrière-plan des notifications retrouve ainsi la file du compte, sans écran ouvert.
    await SecureStore.setItemAsync(LAST_OWNER_KEY, ownerId, secureOptions).catch(() => undefined);
  },
  detach: async () => {
    ownerGeneration += 1;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    set({ ownerId: null, items: [], rejectedCount: 0, storageError: false });
    await SecureStore.deleteItemAsync(LAST_OWNER_KEY, secureOptions).catch(() => undefined);
  },
  add: async (op) => {
    const ownerId = get().ownerId;
    if (!ownerId) throw new Error("QUEUE_OWNER_REQUIRED");
    const items = enqueue(get().items, op);
    set({ items });
    try {
      await save(ownerId, items);
    } catch {
      if (get().ownerId === ownerId) set({ storageError: true });
      return;
    }
    await get().flush();
  },
  flush: async () => {
    const ownerId = get().ownerId;
    const generation = ownerGeneration;
    if (!ownerId || get().syncing || (get().items.length === 0 && !get().storageError)) return;
    set({ syncing: true });
    try {
      const batch = get().items;
      // Une écriture précédente a pu échouer faute de place. Ne jamais envoyer
      // avant d'avoir une copie durable que la fermeture de l'app préservera.
      await save(ownerId, batch);
      if (generation !== ownerGeneration) return;
      set({ storageError: false });
      const result = await replay(batch, send, () => generation === ownerGeneration);
      if (generation !== ownerGeneration) {
        // La réponse du compte précédent ne modifie jamais la file du nouveau compte.
        // Son stockage est conservé : le clientId permettra un rejeu sans doublon.
        return;
      }
      // Ce qui a été ajouté pendant l'envoi reste dans la file.
      const added = get().items.filter((i) => !batch.includes(i));
      const items = [...result.remaining, ...added];
      set((s) => ({ items, rejectedCount: s.rejectedCount + result.rejected.length }));
      await save(ownerId, items);
      if (result.sent.length > 0 || result.rejected.length > 0) {
        void queryClient.invalidateQueries({ queryKey: ["today"] });
        void queryClient.invalidateQueries({ queryKey: ["session"] });
        void queryClient.invalidateQueries({ queryKey: ["athlete-calendar"] });
      }
      // Serveur occupé alors que le réseau répond : on réessaiera sans attendre un changement d'état.
      if (items.length > reviewRequiredOps(items).length) {
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => void get().flush(), RETRY_MS);
      }
    } catch {
      if (generation === ownerGeneration) set({ storageError: true });
    } finally {
      set({ syncing: false });
      if (generation !== ownerGeneration && get().ownerId) void get().flush();
    }
  },
  dismissRejected: () => set({ rejectedCount: 0 }),
}));

export const newClientId = (): string => Crypto.randomUUID();

export const hydrateLastOwner = async (): Promise<boolean> => {
  if (useOpQueue.getState().ownerId) return true;
  const ownerId = await SecureStore.getItemAsync(LAST_OWNER_KEY, secureOptions).catch(() => null);
  if (!ownerId) return false;
  await useOpQueue.getState().hydrate(ownerId);
  return true;
};

// Une notification peut être traitée deux fois (écouteur et tâche) : son identifiant donne un clientId stable.
export const submitValidation = (
  orgId: string,
  sessionId: string,
  input: Omit<SessionLogInput, "clientId">,
  clientId: string = newClientId(),
) => {
  const id = clientId;
  return useOpQueue.getState().add({
    id,
    kind: "log",
    orgId,
    sessionId,
    queuedAt: new Date().toISOString(),
    input: { ...input, clientId: id, completedAt: input.completedAt ?? new Date().toISOString() },
  });
};

export const submitAttendance = (orgId: string, sessionId: string, status: "present" | "absent") =>
  useOpQueue.getState().add({
    id: newClientId(),
    kind: "attendance",
    orgId,
    sessionId,
    status,
    queuedAt: new Date().toISOString(),
  });

// Le clientId rend le rejeu idempotent : un essai n'est jamais compté deux fois.
export const submitJumpAttempt = (orgId: string, input: Omit<JumpAttemptInput, "clientId">) => {
  const id = newClientId();
  return useOpQueue.getState().add({
    id,
    kind: "attempt",
    orgId,
    input: { ...input, clientId: id },
    queuedAt: new Date().toISOString(),
  });
};
