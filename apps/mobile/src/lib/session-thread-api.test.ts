import { createApiClient, sessionThreadPath } from "@tartan/api-client";
import { describe, expect, it, vi } from "vitest";

const target = { orgId: "org", sessionId: "session", athleteId: "athlete", itemRef: "A / tour#1&2" };
const id = "00000000-0000-4000-8000-000000000001";

describe("client des échanges privés de séance", () => {
  it("adresse le débrief personnel et chaque exercice du coach sur toutes les routes", () => {
    expect(sessionThreadPath({ orgId: "org", sessionId: "session" })).toBe("/orgs/org/sessions/session/thread");
    for (const action of ["audio", "transcript"] as const) {
      const url = new URL(sessionThreadPath(target, { messageId: "root", action }), "https://example.test");
      expect(url.pathname).toBe(`/orgs/org/sessions/session/thread/root/${action}`);
      expect(Object.fromEntries(url.searchParams)).toEqual({ athleteId: "athlete", itemRef: "A / tour#1&2" });
    }
  });

  it("relit sans transcrire et n’envoie l’accord que pour le vocal choisi", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ root: null, messages: [] }))
      .mockResolvedValueOnce(Response.json({ id }))
      .mockResolvedValueOnce(Response.json({ transcript: "Consigne" }));
    const client = createApiClient({
      baseUrl: "https://example.test",
      fetch: (url, init) => request(String(url), init),
      headers: () => ({ Cookie: "fixture" }),
    });
    const signal = new AbortController().signal;
    await client.sessionThread(target, signal);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]![1]).toMatchObject({ method: "GET", signal, headers: { Cookie: "fixture" } });
    await client.replyToSessionThread(target, { clientId: id, text: "Réponse" });
    expect(JSON.parse(String(request.mock.calls[1]![1]?.body))).toEqual({ clientId: id, text: "Réponse" });
    await expect(client.transcribeSessionMessage(target, "root", id, true)).resolves.toEqual({
      transcript: "Consigne",
    });
    const [url, options] = request.mock.calls[2]!;
    expect(String(url)).toBe(
      "https://example.test/api/v1" + sessionThreadPath(target, { messageId: "root", action: "transcript" }),
    );
    expect(JSON.parse(String(options?.body))).toEqual({ consent: true, version: id });
  });
});
