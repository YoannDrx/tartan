import { describe, expect, it, vi } from "vitest";
import { orNotFound } from "@/features/shell/space";

vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  notFound: () => {
    throw new Error("introuvable");
  },
}));

describe("orNotFound", () => {
  it("traite un identifiant mal formé comme une page introuvable", async () => {
    const badId = Object.assign(new Error("invalid input syntax for type uuid"), { code: "P2007" });
    await expect(orNotFound(() => Promise.reject(badId))).rejects.toThrow("introuvable");
  });

  it("laisse passer une vraie panne", async () => {
    const outage = Object.assign(new Error("base injoignable"), { code: "P1001" });
    await expect(orNotFound(() => Promise.reject(outage))).rejects.toThrow("base injoignable");
  });
});
