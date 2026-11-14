import { afterEach, expect, it, vi } from "vitest";
import { handleRouteError } from "@/lib/zod-route";
import { log } from "@/lib/logger";

afterEach(() => vi.restoreAllMocks());
it("journalise seulement le code Prisma stable, sans message ni métadonnées", async () => {
  const write = vi.spyOn(log, "error").mockImplementation(() => undefined);
  const cause = Object.assign(new Error("contenu personnel à ne pas journaliser"), {
    name: "PrismaClientKnownRequestError",
    code: "P2028",
    meta: { query: "requête privée" },
  });
  const response = handleRouteError(cause);
  expect(write).toHaveBeenCalledWith("route_failed", { code: "P2028" });
  expect(response.status).toBe(500);
  const body = await response.text();
  expect(body).not.toContain("P2028");
  expect(body).not.toContain("personnel");
  expect(JSON.stringify(write.mock.calls)).not.toContain("privée");
});
it("ne journalise pas un champ code arbitraire", () => {
  const write = vi.spyOn(log, "error").mockImplementation(() => undefined);
  handleRouteError(Object.assign(new Error("privé"), { name: "PrismaClientKnownRequestError", code: "donnée privée" }));
  expect(write).toHaveBeenCalledWith("route_failed", { code: "PrismaClientKnownRequestError" });
});
