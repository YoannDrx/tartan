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

type OpQueueState = {
  ownerId: string | null;
  items: QueuedOp[];
  syncing: boolean;
  rejectedCount: number;
  hydrate: (ownerId: string) => Promise<void>;
  add: (op: QueuedOp) => Promise<void>;
  flush: () => Promise<void>;
  dismissRejected: () => void;
};

const save = async (ownerId: string | null, items: QueuedOp[]) => {
  if (!ownerId) return;
  if (items.length === 0) await chunked.remove(keyFor(ownerId));
  else await chunked.write(keyFor(ownerId), toAsciiJson(items));
};

export const useOpQueue = create<OpQueueState>((set, get) => ({
  ownerId: null,
  items: [],
  syncing: false,
  rejectedCount: 0,
  hydrate: async (ownerId) => {
    if (get().ownerId === ownerId) return;
    const items = parseQueue(await chunked.read(keyFor(ownerId)));
    set({ ownerId, items });
    // La tâche d'arrière-plan des notifications retrouve ainsi la file du compte, sans écran ouvert.
    await SecureStore.setItemAsync(LAST_OWNER_KEY, ownerId, secureOptions).catch(() => undefined);
  },
  add: async (op) => {
    const items = enqueue(get().items, op);
    set({ items });
    await save(get().ownerId, items);
    await get().flush();
  },
  flush: async () => {
    if (get().syncing || get().items.length === 0) return;
    set({ syncing: true });
    try {
      const batch = get().items;
      const result = await replay(batch, send);
      // Ce qui a été ajouté pendant l'envoi reste dans la file.
      const added = get().items.filter((i) => !batch.includes(i));
      const items = [...result.remaining, ...added];
      set((s) => ({ items, rejectedCount: s.rejectedCount + result.rejected.length }));
      await save(get().ownerId, items);
      if (result.sent.length > 0 || result.rejected.length > 0) {
        void queryClient.invalidateQueries({ queryKey: ["today"] });
        void queryClient.invalidateQueries({ queryKey: ["session"] });
        void queryClient.invalidateQueries({ queryKey: ["athlete-calendar"] });
      }
      // Serveur occupé alors que le réseau répond : on réessaiera sans attendre un changement d'état.
      if (result.remaining.length > 0) {
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => void get().flush(), RETRY_MS);
      }
    } finally {
      set({ syncing: false });
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
