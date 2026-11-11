import { describe, expect, it } from "vitest";
import {
  coachChecklist,
  coachNextStep,
  coachOnboardingDone,
  coachProgress,
  type CoachOnboardingFacts,
} from "./onboarding";

const empty: CoachOnboardingFacts = { invitations: 0, athletes: 0, sessions: 0, publishedSessions: 0, validations: 0 };
const doneKeys = (facts: CoachOnboardingFacts) =>
  coachChecklist(facts)
    .filter((step) => step.done)
    .map((step) => step.key);

describe("premiers pas du coach", () => {
  it("un espace neuf commence par inviter", () => {
    expect(doneKeys(empty)).toEqual([]);
    expect(coachNextStep(empty)).toBe("invite");
    expect(coachProgress(empty)).toEqual({ done: 0, total: 4 });
  });

  it("inviter suffit, sans attendre que l'athlète accepte", () => {
    expect(doneKeys({ ...empty, invitations: 1 })).toEqual(["invite"]);
    expect(doneKeys({ ...empty, athletes: 1 })).toEqual(["invite"]);
    expect(coachNextStep({ ...empty, invitations: 1 })).toBe("create");
  });

  it("créer et publier sont deux étapes distinctes", () => {
    const drafted = { ...empty, athletes: 2, sessions: 1 };
    expect(doneKeys(drafted)).toEqual(["invite", "create"]);
    expect(coachNextStep(drafted)).toBe("publish");
    expect(coachNextStep({ ...drafted, publishedSessions: 1 })).toBe("validate");
  });

  it("le coach qui crée avant d'inviter garde l'invitation comme prochaine étape", () => {
    const facts = { ...empty, sessions: 1, publishedSessions: 1 };
    expect(doneKeys(facts)).toEqual(["create", "publish"]);
    expect(coachNextStep(facts)).toBe("invite");
  });

  it("une étape avancée prouve les précédentes", () => {
    // Une séance supprimée après validation ne fait pas reculer le guide.
    const facts = { ...empty, validations: 1 };
    expect(doneKeys(facts)).toEqual(["invite", "create", "publish", "validate"]);
    expect(coachNextStep(facts)).toBeNull();
    expect(coachOnboardingDone(facts)).toBe(true);
    expect(coachProgress(facts)).toEqual({ done: 4, total: 4 });
  });
});
