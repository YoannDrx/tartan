import { ApiError } from "@tartan/api-client";
import type { AthleteSessionCard, AthleteToday } from "@tartan/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  versionAfterPendingLogs,
  feedbackAfterPendingLogs,
  applyPendingToCard,
  applyPendingToToday,
  createChunkedStore,
  enqueue,
  isRetryable,
  parseQueue,
  replay,
  toAsciiJson,
  type LogOp,
  type QueuedOp,
} from "./queue-core";

const log = (sessionId: string, id = `client-${sessionId}`): LogOp => ({
  id,
  kind: "log",
  orgId: "org",
  sessionId,
  queuedAt: "2026-11-01T10:00:00.000Z",
  input: { clientId: id, status: "done", variantDone: "club", sets: [] },
});

const card = (over: Partial<AthleteSessionCard> = {}): AthleteSessionCard => ({
  id: "s1",
  title: "Pliométrie",
  type: "plyo",
  date: "2026-11-01",
  startTime: null,
  location: null,
  coachName: null,
  coachNote: null,
  durationMin: null,
  exerciseCount: 3,
  variant: "club",
  hasAutonomous: true,
  status: "upcoming",
  attendance: "unknown",
  ...over,
});

describe("enqueue", () => {
  it("ne remplace ni une écriture versionnée ni un conflit par une validation rapide", () => {
    const versioned = { ...log("s1", "detail"), input: { ...log("s1", "detail").input, expectedVersion: 1 } };
    expect(enqueue([versioned], log("s1", "quick"))).toHaveLength(2);
    expect(enqueue([{ ...log("s1", "conflict"), blocked: { status: 409 } }], log("s1", "quick"))).toHaveLength(2);
    expect(enqueue([versioned], { ...versioned, input: { ...versioned.input, status: "partial" } })).toEqual([
      versioned,
    ]);
  });
  it("remplace une validation en attente pour la même séance", () => {
    const items = enqueue(enqueue([], log("s1", "a-client")), log("s1", "b-client"));
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("b-client");
  });

  it("garde une validation et une présence de la même séance", () => {
    const att: QueuedOp = {
      id: "p",
      kind: "attendance",
      orgId: "org",
      sessionId: "s1",
      status: "absent",
      queuedAt: "",
    };
    expect(enqueue(enqueue([], log("s1")), att)).toHaveLength(2);
  });

  it("additionne les essais de saut", () => {
    const attempt: QueuedOp = {
      id: "j1",
      kind: "attempt",
      orgId: "org",
      queuedAt: "",
      input: { athleteId: "a", barHeightCm: 160, attemptNo: 1, result: "O" },
    };
    expect(enqueue(enqueue([], attempt), { ...attempt, id: "j2" })).toHaveLength(2);
  });
});

describe("isRetryable", () => {
  it("réessaie réseau, serveur et session expirée", () => {
    expect(isRetryable(new TypeError("Network request failed"))).toBe(true);
    expect(isRetryable(new ApiError(503, undefined, "x"))).toBe(true);
    expect(isRetryable(new ApiError(401, undefined, "x"))).toBe(true);
    expect(isRetryable(new ApiError(429, undefined, "x"))).toBe(true);
  });

  it("abandonne sur un refus définitif", () => {
    expect(isRetryable(new ApiError(404, undefined, "x"))).toBe(false);
    expect(isRetryable(new ApiError(400, undefined, "x"))).toBe(false);
    expect(isRetryable(new ApiError(403, undefined, "x"))).toBe(false);
  });
});

describe("replay", () => {
  it("garde les conflits et leurs dépendants sans bloquer les autres séances", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(409, undefined, "private"))
      .mockResolvedValue(undefined);
    const result = await replay([log("s1", "first"), log("s1", "next"), log("s2")], send);
    expect(result.rejected).toEqual([]);
    expect(result.sent.map((op) => op.id)).toEqual(["client-s2"]);
    expect(result.remaining.map((op) => op.id)).toEqual(["first", "next"]);
    expect(result.remaining[0]?.blocked).toEqual({ status: 409 });
    expect(JSON.stringify(result)).not.toContain("private");
    send.mockClear();
    expect((await replay(result.remaining, send)).remaining).toEqual(result.remaining);
    expect(send).not.toHaveBeenCalled();
    expect(applyPendingToCard(card(), result.remaining).status).toBe("upcoming");
  });

  it("conserve les séries versionnées même après un refus d'accès", async () => {
    const op = { ...log("s1"), input: { ...log("s1").input, expectedVersion: 1 } };
    const result = await replay([op], vi.fn().mockRejectedValue(new ApiError(403, undefined, "x")));
    expect(result.remaining).toEqual([{ ...op, blocked: { status: 403 } }]);
    expect(result.rejected).toEqual([]);
  });

  it("arrête les appels après un changement de propriétaire", async () => {
    let current = true;
    const send = vi.fn(async () => {
      current = false;
    });
    const result = await replay([log("s1"), log("s2")], send, () => current);
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.remaining).toEqual([log("s2")]);
  });
  it("envoie dans l'ordre et vide la file", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const result = await replay([log("s1"), log("s2")], send);
    expect(send.mock.calls.map(([op]) => (op as LogOp).sessionId)).toEqual(["s1", "s2"]);
    expect(result.remaining).toEqual([]);
    expect(result.sent).toHaveLength(2);
  });

  it("garde le clientId d'origine : l'API reconnaît le rejeu", async () => {
    const items = [log("s1", "stable-client")];
    const first = vi.fn().mockRejectedValue(new TypeError("offline"));
    const { remaining } = await replay(items, first);
    const second = vi.fn().mockResolvedValue(undefined);
    await replay(remaining, second);
    const sent = second.mock.calls[0]?.[0] as LogOp;
    expect(sent.input.clientId).toBe("stable-client");
  });

  it("s'arrête à la première erreur temporaire", async () => {
    const send = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new TypeError("offline"));
    const result = await replay([log("s1"), log("s2"), log("s3")], send);
    expect(send).toHaveBeenCalledTimes(2);
    expect(result.sent).toHaveLength(1);
    expect(result.remaining.map((o) => (o as LogOp).sessionId)).toEqual(["s2", "s3"]);
  });

  it("écarte un refus définitif sans bloquer la suite", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(404, undefined, "x"))
      .mockResolvedValueOnce(undefined);
    const result = await replay([log("s1"), log("s2")], send);
    expect(result.rejected).toHaveLength(1);
    expect(result.sent).toHaveLength(1);
    expect(result.remaining).toEqual([]);
  });
});

describe("applyPendingToCard", () => {
  it("affiche la validation en attente", () => {
    const op: LogOp = { ...log("s1"), input: { ...log("s1").input, status: "partial", variantDone: "autonomous" } };
    const out = applyPendingToCard(card(), [op]);
    expect(out.status).toBe("partial");
    expect(out.variant).toBe("autonomous");
  });

  it("bascule en autonomie si l'athlète ne vient pas et que la version existe", () => {
    const op: QueuedOp = { id: "p", kind: "attendance", orgId: "org", sessionId: "s1", status: "absent", queuedAt: "" };
    expect(applyPendingToCard(card(), [op]).variant).toBe("autonomous");
    expect(applyPendingToCard(card({ hasAutonomous: false }), [op]).variant).toBe("club");
  });

  it("ignore les autres séances", () => {
    expect(applyPendingToCard(card(), [log("autre")]).status).toBe("upcoming");
  });
});

describe("applyPendingToToday", () => {
  const today: AthleteToday = {
    firstName: "Léa",
    today: [card()],
    next: null,
    week: [{ date: "2026-11-01", status: "today" }],
    pinnedAnnouncement: null,
    healthConsent: true,
    videoConsent: true,
    parentalConsentPending: false,
  };

  it("marque le jour comme fait", () => {
    expect(applyPendingToToday(today, [log("s1")], "2026-11-01").week[0]?.status).toBe("done");
  });

  it("ne change rien sans file", () => {
    expect(applyPendingToToday(today, [], "2026-11-01").week[0]?.status).toBe("today");
  });
});

describe("createChunkedStore", () => {
  const memory = () => {
    const map = new Map<string, string>();
    return {
      map,
      get: async (k: string) => map.get(k) ?? null,
      set: async (k: string, v: string) => void map.set(k, v),
      remove: async (k: string) => void map.delete(k),
    };
  };

  it("relit une valeur découpée et nettoie les anciens morceaux", async () => {
    const backend = memory();
    const store = createChunkedStore(backend, 4);
    await store.write("k", "abcdefghij");
    expect(JSON.parse(backend.map.get("k.head")!).count).toBe(3);
    expect(await store.read("k")).toBe("abcdefghij");
    await store.write("k", "ab");
    expect(backend.map.has("k.1")).toBe(false);
    expect(await store.read("k")).toBe("ab");
    await store.remove("k");
    expect(await store.read("k")).toBeNull();
  });

  it("conserve la génération précédente si l'écriture d'un morceau échoue", async () => {
    const backend = memory();
    const store = createChunkedStore(backend, 4);
    await store.write("k", "abcdefghij");
    const set = backend.set;
    let calls = 0;
    backend.set = async (key, value) => {
      if (++calls === 2) throw new Error("disk full");
      await set(key, value);
    };
    await expect(store.write("k", "0123456789")).rejects.toThrow("disk full");
    expect(await store.read("k")).toBe("abcdefghij");
  });

  it("reprend les anciens morceaux et sérialise deux écritures simultanées", async () => {
    const backend = memory();
    backend.map.set("k.count", "2");
    backend.map.set("k.0", "abcd");
    backend.map.set("k.1", "ef");
    const store = createChunkedStore(backend, 4);
    expect(await store.read("k")).toBe("abcdef");
    await Promise.all([store.write("k", "first-value"), store.write("k", "second-value")]);
    expect(await store.read("k")).toBe("second-value");
    expect(backend.map.has("k.count")).toBe(false);
    expect(backend.map.has("k.0")).toBe(false);
    expect(backend.map.size).toBe(4); // tête + trois morceaux de la dernière génération
  });

  it("signale un morceau manquant au lieu de prendre une file corrompue pour une file vide", async () => {
    const backend = memory();
    backend.map.set("k.count", "1");
    await expect(createChunkedStore(backend).read("k")).rejects.toThrow("QUEUE_STORAGE_CORRUPTED");
  });

  it("échappe les accents en ASCII", () => {
    const raw = toAsciiJson({ comment: "gêne au 3e bond" });
    expect(raw).not.toContain("ê");
    expect(JSON.parse(raw)).toEqual({ comment: "gêne au 3e bond" });
  });
});

describe("parseQueue", () => {
  it("tolère un contenu abîmé", () => {
    expect(parseQueue("pas du json")).toEqual([]);
    expect(parseQueue('{"a":1}')).toEqual([]);
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue(JSON.stringify([{ nope: 1 }, log("s1")]))).toHaveLength(1);
  });
});

it("enchaîne la validation rapide après les séries locales sans masquer un conflit ni une version manquante", () => {
  const series: QueuedOp = {
    ...log("s1", "series"),
    input: { ...log("s1").input, expectedVersion: 2, expectedSessionVersion: 4 },
  };
  const quick: QueuedOp = {
    ...log("s1", "quick"),
    input: { ...log("s1").input, expectedVersion: 3, expectedSessionVersion: 4 },
  };
  expect(versionAfterPendingLogs([series, quick], "org", "s1", 4, 2)).toBe(4);
  expect(versionAfterPendingLogs([series, quick], "org", "s1", 4, 4)).toBe(4);
  expect(versionAfterPendingLogs([series], "other", "s1", 4, 2)).toBe(2);
  expect(versionAfterPendingLogs([{ ...series, blocked: { status: 409 } }, quick], "org", "s1", 4, 2)).toBeNull();
  expect(versionAfterPendingLogs([quick], "org", "s1", 4, 2)).toBeNull();
  expect(versionAfterPendingLogs([series, { ...series, id: "concurrent" }], "org", "s1", 4, 2)).toBeNull();
  expect(versionAfterPendingLogs([series], "org", "s1", 5, 2)).toBeNull();
  expect(versionAfterPendingLogs([log("s1")], "org", "s1", 4, 2)).toBeNull();
  expect(applyPendingToCard(card({ logVersion: 2 }), [series, quick]).logVersion).toBe(4);
});

it("rouvre les retours réellement en attente sans effacer une douleur omise ni lire un autre espace", () => {
  const existing = {
    rpe: 7,
    durationMin: 30,
    comment: "Serveur",
    pain: { bodyArea: "knee" as const, side: "left" as const, intensity: 2 },
  };
  const pending: LogOp = {
    ...log("s1"),
    input: { ...log("s1").input, writeScope: "feedback", comment: "Brouillon", durationMin: 40 },
  };
  const quick: LogOp = { ...log("s1", "quick"), input: { ...log("s1").input, writeScope: "status" } };
  expect(feedbackAfterPendingLogs(existing, [pending, quick], "org", "s1")).toEqual({
    ...existing,
    comment: "Brouillon",
    durationMin: 40,
  });
  expect(feedbackAfterPendingLogs(existing, [pending], "other", "s1")).toEqual(existing);
  expect(feedbackAfterPendingLogs(existing, [{ ...pending, blocked: { status: 409 } }], "org", "s1")).toEqual(existing);
  expect(
    feedbackAfterPendingLogs(
      existing,
      [{ ...pending, input: { ...pending.input, pain: null, rpe: null } }],
      "org",
      "s1",
    ),
  ).toMatchObject({ pain: null, rpe: null });
});

it("ne remet pas dans le formulaire un ancien complément déjà reconnu par le serveur", () => {
  const existing = { rpe: null, pain: null, durationMin: 40, comment: "Correction récente" };
  const old: LogOp = {
    ...log("s1"),
    input: { ...log("s1").input, expectedVersion: 1, writeScope: "feedback", comment: "Ancien texte" },
  };
  expect(feedbackAfterPendingLogs(existing, [old], "org", "s1", 3)).toEqual(existing);
});
