import { describe, expect, it } from "vitest";
import { activationEmailFor, isNearLimit } from "./lifecycle-emails";
import type { CoachOnboardingFacts } from "./onboarding";

const empty: CoachOnboardingFacts = { invitations: 0, athletes: 0, sessions: 0, publishedSessions: 0, validations: 0 };
const createdAt = new Date("2026-11-10T08:00:00Z");
const after = (days: number) => new Date(createdAt.getTime() + days * 86_400_000);
const space = (facts: CoachOnboardingFacts = empty) => ({ id: "espace", createdAt, facts });

describe("e-mails d'activation du coach", () => {
  it("rien le jour de la création : la bienvenue suffit", () => {
    expect(activationEmailFor(space(), after(0.5))).toBeNull();
  });

  it("un rappel à J+1, J+3 et J+7, sur la prochaine étape manquante", () => {
    expect(activationEmailFor(space(), after(1.2))).toEqual({
      day: 1,
      step: "invite",
      dedupeKey: "activation:espace:1",
    });
    expect(activationEmailFor(space({ ...empty, invitations: 2 }), after(3.1))).toMatchObject({
      day: 3,
      step: "create",
    });
    expect(
      activationEmailFor(space({ ...empty, athletes: 4, sessions: 1, publishedSessions: 1 }), after(7.5)),
    ).toMatchObject({ day: 7, step: "validate" });
  });

  it("deux passages dans la même fenêtre donnent la même clé", () => {
    const first = activationEmailFor(space(), after(3.1));
    const second = activationEmailFor(space(), after(4.1));
    expect(first?.dedupeKey).toBe(second?.dedupeKey);
  });

  it("rien entre les fenêtres ni après la dernière", () => {
    expect(activationEmailFor(space(), after(2.5))).toBeNull();
    expect(activationEmailFor(space(), after(5.5))).toBeNull();
    expect(activationEmailFor(space(), after(10))).toBeNull();
    expect(activationEmailFor(space(), after(40))).toBeNull();
  });

  it("un coach activé ne reçoit plus rien", () => {
    expect(activationEmailFor(space({ ...empty, validations: 1 }), after(1.2))).toBeNull();
  });
});

describe("plafond d'offre proche", () => {
  it("à partir de 80 % de la limite, tant qu'elle n'est pas atteinte", () => {
    expect(isNearLimit(30, 23)).toBe(false);
    expect(isNearLimit(30, 24)).toBe(true);
    expect(isNearLimit(30, 29)).toBe(true);
    expect(isNearLimit(30, 30)).toBe(false);
  });

  it("ni pour une offre sans limite, ni pour une limite trop basse pour prévenir utilement", () => {
    expect(isNearLimit(null, 400)).toBe(false);
    expect(isNearLimit(2, 1)).toBe(false);
    expect(isNearLimit(5, 4)).toBe(true);
  });
});
