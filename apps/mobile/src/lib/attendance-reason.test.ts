import { createApiClient } from "@tartan/api-client";
import { describe, expect, it } from "vitest";

// Le motif d'absence part avec l'absence, jamais avec « je viens ».
const capture = () => {
  const bodies: unknown[] = [];
  const api = createApiClient({
    baseUrl: "https://exemple.invalid",
    fetch: (async (_url: string, init?: { body?: string }) => {
      bodies.push(init?.body ? JSON.parse(init.body) : null);
      return new Response(JSON.stringify({ variant: "autonomous", hasAutonomous: true }), { status: 200 });
    }) as unknown as typeof fetch,
  });
  return { api, bodies };
};

describe("motif d'absence", () => {
  it("accompagne une absence", async () => {
    const { api, bodies } = capture();
    await api.setAttendance("org", "session", "absent", "transport");
    expect(bodies).toEqual([{ status: "absent", reason: "transport" }]);
  });

  it("n'accompagne jamais une présence, et reste facultatif", async () => {
    const { api, bodies } = capture();
    await api.setAttendance("org", "session", "present", "work");
    await api.setAttendance("org", "session", "absent");
    expect(bodies).toEqual([{ status: "present" }, { status: "absent" }]);
  });
});
