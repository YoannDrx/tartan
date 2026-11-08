import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pendingStatusFor, sendValidation } from "@/features/athlete-view/validation-queue";
import * as storage from "@/features/offline/idb";
import { idbAll, idbDelete } from "@/features/offline/idb";
import {
  replaceReviewedLogs,
  flushOps,
  isSessionExpired,
  pendingOps,
  setQueueOwner,
  type QueuedOp,
} from "@/features/offline/op-queue";

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

  it("garde l'ordre de saisie même dans la même milliseconde", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(123);
    try {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
      await sendValidation(pending("z-first"));
      await sendValidation(pending("a-second"));
      expect((await pendingOps()).map((op) => op.id)).toEqual(["z-first", "a-second"]);
    } finally {
      now.mockRestore();
    }
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

  it("conserve un conflit et ses écritures suivantes, mais synchronise une autre séance", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await sendValidation(pending("first"));
    await sendValidation(pending("next"));
    await sendValidation({ ...pending("other"), sessionId: "other-session" });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 409 }))
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    expect(await flushOps()).toEqual({ sent: 1, rejected: 0 });
    expect(fetch).toHaveBeenCalledTimes(2);
    const saved = await pendingOps();
    expect(saved.map((op) => op.id)).toEqual(["first", "next"]);
    expect(saved[0]?.blocked).toEqual({ status: 409 });
    expect(await pendingStatusFor("session")).toBeNull();
    fetch.mockClear();
    await flushOps();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("conserve aussi une saisie détaillée refusée immédiatement, sans son message sensible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "private" }), { status: 403 })),
    );
    const input = { ...pending().input, expectedVersion: 2, expectedSessionVersion: 3, detailedSets: [] };
    expect((await sendValidation({ ...pending(), input })).state).toBe("error");
    const [saved] = await pendingOps();
    expect(saved?.blocked).toEqual({ status: 403 });
    expect(saved?.body).toEqual(input);
    expect(JSON.stringify(saved)).not.toContain("private");
  });

  it("persiste avant l'appel réseau et empêche un rejeu parallèle pendant l'envoi", async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const input = { ...pending().input, expectedVersion: 0, expectedSessionVersion: 1, detailedSets: [] };
    const first = sendValidation({ ...pending(), input });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(await pendingOps()).toHaveLength(1);
    await flushOps();
    const second = sendValidation({ ...pending(), input });
    expect(fetch).toHaveBeenCalledTimes(1);
    resolve(new Response("{}", { status: 200 }));
    expect((await first).state).toBe("sent");
    expect((await second).state).toBe("sent");
    expect(await pendingOps()).toHaveLength(0);
  });

  it("arrête l'envoi dès qu'un autre compte prend la main", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await sendValidation(pending("first"));
    await sendValidation({ ...pending("second"), sessionId: "s2" });
    const fetch = vi.fn().mockImplementation(async () => {
      setQueueOwner("other");
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    expect(await flushOps()).toEqual({ sent: 1, rejected: 0 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await pendingOps()).toHaveLength(0);
    setQueueOwner("moi");
    expect((await pendingOps()).map((op) => op.id)).toEqual(["second"]);
  });

  it("conserve l'accusé serveur et reprend le nettoyage local sans perdre l'ordre", async () => {
    respond(200);
    const remove = vi.spyOn(storage, "idbDelete").mockRejectedValue(new Error("storage unavailable"));
    try {
      const input = { ...pending().input, expectedVersion: 0, expectedSessionVersion: 1 };
      expect((await sendValidation({ ...pending(), input })).state).toBe("sent");
      expect(await pendingOps()).toHaveLength(1);
      expect(await flushOps()).toEqual({ sent: 1, rejected: 0 });
      expect(await pendingOps()).toHaveLength(1);
    } finally {
      remove.mockRestore();
    }
    expect(await flushOps()).toEqual({ sent: 1, rejected: 0 });
    expect(await pendingOps()).toHaveLength(0);
  });

  it("remplace le lot relu atomiquement, sans perdre une autre séance ni accepter une vue périmée", async () => {
    respond(409);
    await sendValidation(pending("old-local"));
    const observed = await pendingOps();
    const input = {
      clientId: "new-local",
      status: "done" as const,
      variantDone: "club" as const,
      expectedVersion: 3,
      expectedSessionVersion: 2,
      writeScope: "status" as const,
    };
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new Error("disk");
    });
    await expect(replaceReviewedLogs(observed, { id: input.clientId, body: input })).rejects.toThrow();
    put.mockRestore();
    expect(await pendingOps()).toEqual(observed);
    await sendValidation({ ...pending("other-one"), sessionId: "other" });
    await replaceReviewedLogs(observed, { id: input.clientId, body: input });
    expect((await pendingOps()).map((op) => op.id)).toEqual(["new-local", "other-one"]);
    await expect(replaceReviewedLogs(observed, null)).rejects.toThrow("REVIEW_CHANGED");
    expect((await pendingOps())[0]?.body).toEqual(input);
    expect((await pendingOps())[0]?.blocked).toBeUndefined();
  });

  it("n'efface pas une nouvelle saisie ajoutée après la comparaison", async () => {
    respond(409);
    await sendValidation(pending("old-local"));
    const observed = await pendingOps();
    await storage.idbPut("ops", { ...observed[0], id: "new-following", createdAt: Date.now() + 1 });
    await expect(replaceReviewedLogs(observed, null)).rejects.toThrow("REVIEW_CHANGED");
    expect(await pendingOps()).toHaveLength(2);
    setQueueOwner("other-owner");
    await expect(replaceReviewedLogs(observed, null)).rejects.toThrow("REVIEW_CHANGED");
  });
  it("un conflit coach ne bloque pas un autre athlète et n'altère pas la validation personnelle", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const coachPending = (id: string, athleteId: string) => ({
      ...pending(id),
      athleteId,
      athleteName: athleteId,
      input: { ...pending(id).input, expectedVersion: 0, expectedSessionVersion: 1, variantDone: "club" as const },
    });
    await sendValidation(coachPending("a1", "a"));
    await sendValidation(coachPending("a2", "a"));
    await sendValidation(coachPending("b1", "b"));
    expect(await pendingStatusFor("session")).toBeNull();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 409 }))
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    expect(await flushOps()).toEqual({ sent: 1, rejected: 0 });
    expect(fetch.mock.calls.map((call) => call[0])).toEqual([
      "/api/v1/orgs/org/sessions/session/athletes/a/log",
      "/api/v1/orgs/org/sessions/session/athletes/b/log",
    ]);
    const observed = await pendingOps();
    expect(observed.map((op) => op.id)).toEqual(["a1", "a2"]);
    await replaceReviewedLogs(observed, {
      id: "reviewed",
      body: { ...coachPending("reviewed", "a").input, expectedVersion: 2 },
    });
    await flushOps();
    expect(fetch).toHaveBeenLastCalledWith("/api/v1/orgs/org/sessions/session/athletes/a/log", expect.anything());
    expect(await pendingOps()).toEqual([]);
  });
});
