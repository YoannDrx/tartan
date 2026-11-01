import { ApiError } from "@tartan/api-client";
import { m } from "@tartan/i18n";
import { describe, expect, it } from "vitest";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("n'incite jamais à l'achat sur une limite d'offre", () => {
    for (const message of [m.billing.limitAthletes, m.billing.limitGroups, m.billing.limitCoaches, m.billing.limitVideos]) {
      const text = errorMessage(new ApiError(402, "plan_limit", message));
      expect(text).toBe(m.mobile.errors.planLimit);
      expect(text).not.toMatch(/offre|abonnement|passe à/i);
    }
  });

  it("garde le message neutre destiné à l'athlète qui rejoint un groupe complet", () => {
    expect(errorMessage(new ApiError(402, "plan_limit", m.billing.limitJoinAthlete))).toBe(m.billing.limitJoinAthlete);
  });

  it("garde les autres messages du serveur", () => {
    expect(errorMessage(new ApiError(400, "invalid", "Adresse invalide"))).toBe("Adresse invalide");
  });
});
