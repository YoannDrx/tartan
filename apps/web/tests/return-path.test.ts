import { describe, expect, it } from "vitest";
import { safeReturnPath, signInPath } from "@/lib/return-path";

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

describe("adresse de la connexion qui ramène à la page demandée", () => {
  it("garde la page demandée, requête comprise", () => {
    expect(signInPath("/calendrier?vue=mois")).toBe("/connexion?next=%2Fcalendrier%3Fvue%3Dmois");
    expect(safeReturnPath(new URLSearchParams(signInPath("/seances/abc").split("?")[1]).get("next")!)).toBe(
      "/seances/abc",
    );
  });
  it.each([null, undefined, "", "/accueil", "//evil.invalid", "https://evil.invalid/x", "/\\evil.invalid"])(
    "n'écrit rien pour %s",
    (value) => {
      expect(signInPath(value)).toBe("/connexion");
    },
  );
});
