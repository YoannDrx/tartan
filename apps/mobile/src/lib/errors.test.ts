import { ApiError } from "@tartan/api-client";
import { m } from "@tartan/i18n";
import { describe, expect, it } from "vitest";
import { deniesCachedAccess, errorMessage } from "./errors";

it("cache hors ligne disponible, accès révoqué ou ressource supprimée masqués", () => {
  expect(deniesCachedAccess(new TypeError("Network request failed"))).toBe(false);
  expect(deniesCachedAccess(new ApiError(503, "unavailable", "Indisponible"))).toBe(false);
  for (const status of [401, 403, 404])
    expect(deniesCachedAccess(new ApiError(status, undefined, "Accès refusé"))).toBe(true);
});

describe("errorMessage", () => {
  it("n'incite jamais à l'achat sur une limite d'offre", () => {
    for (const message of [
      m.billing.limitAthletes,
      m.billing.limitGroups,
      m.billing.limitCoaches,
      m.billing.limitVideos,
    ]) {
      const text = errorMessage(new ApiError(402, "plan_limit", message));
      expect(text).toBe(m.mobile.errors.planLimit);
      expect(text).not.toMatch(/offre|abonnement|passe à/i);
    }
  });

  it("n'incite pas à l'achat quand un compte a déjà un espace Découverte", () => {
    const text = errorMessage(new ApiError(409, "discovery_limit", m.onboarding.discoveryLimit));
    expect(text).toBe(m.mobile.errors.discoveryLimit);
    expect(text).not.toMatch(/payant|abonnement|passe/i);
  });

  it("garde le message neutre destiné à l'athlète qui rejoint un groupe complet", () => {
    expect(errorMessage(new ApiError(402, "plan_limit", m.billing.limitJoinAthlete))).toBe(m.billing.limitJoinAthlete);
  });

  it("garde les autres messages du serveur", () => {
    expect(errorMessage(new ApiError(400, "invalid", "Adresse invalide"))).toBe("Adresse invalide");
  });
});
