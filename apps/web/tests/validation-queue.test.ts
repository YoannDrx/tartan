import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pendingStatusFor, sendValidation } from "@/features/athlete-view/validation-queue";
import { idbAll, idbDelete } from "@/features/offline/idb";
import { flushOps, isSessionExpired, pendingOps, setQueueOwner, type QueuedOp } from "@/features/offline/op-queue";

const pending = (clientId = "client-1") =>
  ({
    organizationId: "org",
    sessionId: "session",
    input: { clientId, status: "done" },
  }) as unknown as Parameters<typeof sendValidation>[0];

const respond = (status: number) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));

describe("file d'attente hors ligne", () => {
  beforeEach(async () => {
    vi.stubGlobal("window", new EventTarget());
    setQueueOwner("moi");
    for (const op of await idbAll<QueuedOp>("ops")) await idbDelete("ops", op.id);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("garde la validation sans réseau, et la montre comme faite", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect(await sendValidation(pending())).toEqual({ state: "queued", reason: "offline" });
    expect(await pendingStatusFor("session")).toBe("done");
  });

  it("garde la validation quand la session a expiré, la rejoue ensuite, puis l'oublie", async () => {
    respond(401);
    expect(await sendValidation(pending())).toEqual({ state: "queued", reason: "session" });
    expect(await flushOps()).toEqual({ sent: 0, rejected: 0 });
    expect(isSessionExpired()).toBe(true);
    expect(await pendingOps()).toHaveLength(1);
    respond(200);
    expect(await flushOps()).toEqual({ sent: 1, rejected: 0 });
    expect(await pendingOps()).toEqual([]);
    expect(isSessionExpired()).toBe(false);
  });

  it("s'arrête au premier échec de réseau pour garder l'ordre", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await sendValidation(pending("client-1"));
    await sendValidation(pending("client-2"));
    respond(503);
    await flushOps();
    expect(await pendingOps()).toHaveLength(2);
  });

  it("abandonne une action refusée pour de bon et le signale", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await sendValidation(pending());
    respond(404);
    expect(await flushOps()).toEqual({ sent: 0, rejected: 1 });
    expect(await pendingOps()).toEqual([]);
  });

  it("ne rejoue jamais les actions d'un autre compte sur le même appareil", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await sendValidation(pending());
    setQueueOwner("quelqu-un-d-autre");
    respond(200);
    expect(await flushOps()).toEqual({ sent: 0, rejected: 0 });
    setQueueOwner("moi");
    expect(await pendingOps()).toHaveLength(1);
  });
});
