import { describe, expect, it } from "vitest";
import { safeReturnPath } from "@/lib/return-path";

describe("destination après connexion", () => {
  it.each([
    undefined,
    "https://evil.invalid",
    "//evil.invalid",
    "/\\evil.invalid",
    "/a/..//evil.invalid",
    "/%2e%2e//evil.invalid",
    "/\t/evil.invalid",
    "/\n\\evil.invalid",
    "javascript:alert(1)",
  ])("refuse la destination externe ou ambiguë %s", (value) => {
    expect(safeReturnPath(value)).toBe("/accueil");
  });
  it.each(["/accueil", "/i/invitation?espace=club", "/abonnement?offre=coach&interval=year#tarifs"])(
    "conserve le chemin local %s",
    (value) => {
      expect(safeReturnPath(value)).toBe(value);
    },
  );
});
