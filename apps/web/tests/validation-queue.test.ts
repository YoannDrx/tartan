import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushValidations, sendValidation } from "@/features/athlete-view/validation-queue";

const pending = {
  organizationId: "org",
  sessionId: "session",
  input: { clientId: "client-1", status: "done" },
} as unknown as Parameters<typeof sendValidation>[0];

describe("file de validation hors ligne", () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const respond = (status: number) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));

  it("garde la validation quand la session a expiré", async () => {
    respond(401);
    expect((await sendValidation(pending)).state).toBe("error");
    expect(await flushValidations()).toBe(0);
    expect(JSON.parse(store["tartan.validations"] as string)).toHaveLength(1);
  });

  it("la rejoue au retour de la session, puis l'oublie", async () => {
    respond(401);
    await sendValidation(pending);
    respond(200);
    expect(await flushValidations()).toBe(1);
    expect(JSON.parse(store["tartan.validations"] as string)).toEqual([]);
  });

  it("abandonne une validation refusée pour de bon", async () => {
    respond(401);
    await sendValidation(pending);
    respond(404);
    expect(await flushValidations()).toBe(1);
  });
});
