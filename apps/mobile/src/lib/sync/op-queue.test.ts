import { ApiError } from "@tartan/api-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogOp } from "./queue-core";

const mocks = vi.hoisted(() => ({
  disk: new Map<string, string>(),
  failStorage: false,
  log: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "uuid-test" }));
vi.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "private",
  getItemAsync: async (key: string) => mocks.disk.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (mocks.failStorage) throw new Error("storage full");
    mocks.disk.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mocks.disk.delete(key);
  },
}));
vi.mock("../api", () => ({ api: { logSession: mocks.log } }));
vi.mock("../query-client", () => ({ queryClient: { invalidateQueries: mocks.invalidate } }));
import { hydrateLastOwner, useOpQueue } from "./op-queue";

const log = (id: string): LogOp => ({
  id,
  kind: "log",
  orgId: "org",
  sessionId: id,
  queuedAt: new Date().toISOString(),
  input: { clientId: id, status: "done", variantDone: "club", sets: [], expectedVersion: 0, expectedSessionVersion: 1 },
});
const queue = () => useOpQueue.getState();

beforeEach(async () => {
  await queue().detach();
  mocks.disk.clear();
  mocks.failStorage = false;
  mocks.log.mockReset();
  mocks.invalidate.mockReset();
});
afterEach(async () => {
  await queue().detach();
});

describe("file native persistante", () => {
  it("retrouve un conflit après relance sans le renvoyer", async () => {
    await queue().hydrate("first");
    mocks.log.mockRejectedValue(new ApiError(409, undefined, "private"));
    await queue().add(log("s1"));
    expect(queue().items[0]?.blocked).toEqual({ status: 409 });
    await queue().detach();
    await queue().hydrate("first");
    expect(queue().items[0]?.blocked).toEqual({ status: 409 });
    mocks.log.mockClear();
    await queue().flush();
    expect(mocks.log).not.toHaveBeenCalled();
  });

  it("ne mélange pas les comptes lors d'un changement pendant une réponse réseau", async () => {
    await queue().hydrate("first");
    let resolve!: () => void;
    mocks.log.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const flight = queue().add(log("s1"));
    await vi.waitFor(() => expect(mocks.log).toHaveBeenCalledTimes(1));
    await queue().add(log("s2"));
    await queue().hydrate("second");
    resolve();
    await flight;
    expect(queue().ownerId).toBe("second");
    expect(queue().items).toEqual([]);
    expect(mocks.log).toHaveBeenCalledTimes(1);
    await queue().hydrate("first");
    expect(queue().items.map((op) => op.id)).toEqual(["s1", "s2"]);
  });

  it("détache les actions à la déconnexion mais les conserve pour ce compte", async () => {
    await queue().hydrate("first");
    mocks.log.mockRejectedValue(new TypeError("offline"));
    await queue().add(log("s1"));
    await queue().detach();
    expect(await hydrateLastOwner()).toBe(false);
    expect(queue().items).toEqual([]);
    await queue().hydrate("first");
    expect(queue().items.map((op) => op.id)).toEqual(["s1"]);
  });

  it("n'envoie pas une saisie non sauvegardée et la reprend après libération du stockage", async () => {
    await queue().hydrate("first");
    mocks.failStorage = true;
    await queue().add(log("s1"));
    expect(queue().storageError).toBe(true);
    expect(queue().items).toHaveLength(1);
    expect(mocks.log).not.toHaveBeenCalled();
    mocks.failStorage = false;
    mocks.log.mockResolvedValue({});
    await queue().flush();
    expect(queue().storageError).toBe(false);
    expect(queue().items).toEqual([]);
    expect(mocks.log).toHaveBeenCalledTimes(1);
  });
});
