import { describe, expect, it } from "vitest";
import {
  athleteExtrasVisible,
  athleteWelcomeMode,
  coachActivationStep,
  coachCelebrationDue,
  coachChecklist,
  coachGuideVisible,
  coachNextStep,
  coachOnboardingDone,
  coachOptionalSteps,
  coachProgress,
  coachTourDue,
  screenHintDue,
  type CoachOnboardingFacts,
  type OnboardingMemory,
} from "./onboarding";

const empty: CoachOnboardingFacts = {
  profileComplete: false,
  invitations: 0,
  athletes: 0,
  sessions: 0,
  publishedSessions: 0,
  validations: 0,
  equipment: 0,
  videos: 0,
  phases: 0,
  installed: false,
};
const fresh: OnboardingMemory = {
  tourSeenAt: null,
  welcomeSeenAt: null,
  dismissedAt: null,
  celebratedAt: null,
  skipped: [],
  seenScreens: [],
};
const doneKeys = (facts: CoachOnboardingFacts) =>
  coachChecklist(facts)
    .filter((step) => step.done)
    .map((step) => step.key);
const finished: CoachOnboardingFacts = { ...empty, profileComplete: true, validations: 1 };

describe("premiers pas du coach", () => {
  it("un espace neuf commence par le profil, puis l'invitation", () => {
    expect(doneKeys(empty)).toEqual([]);
    expect(coachNextStep(empty)).toBe("profile");
    expect(coachProgress(empty)).toEqual({ done: 0, total: 5 });
    expect(coachNextStep({ ...empty, profileComplete: true })).toBe("invite");
  });

  it("inviter suffit, sans attendre que l'athlète accepte", () => {
    expect(doneKeys({ ...empty, invitations: 1 })).toEqual(["invite"]);
    expect(doneKeys({ ...empty, athletes: 1 })).toEqual(["invite"]);
    expect(coachNextStep({ ...empty, profileComplete: true, invitations: 1 })).toBe("create");
  });

  it("créer et publier sont deux étapes distinctes", () => {
    const drafted = { ...empty, profileComplete: true, athletes: 2, sessions: 1 };
    expect(doneKeys(drafted)).toEqual(["profile", "invite", "create"]);
    expect(coachNextStep(drafted)).toBe("publish");
    expect(coachNextStep({ ...drafted, publishedSessions: 1 })).toBe("validate");
  });

  it("le coach qui crée avant d'inviter garde l'invitation comme prochaine étape", () => {
    const facts = { ...empty, profileComplete: true, sessions: 1, publishedSessions: 1 };
    expect(doneKeys(facts)).toEqual(["profile", "create", "publish"]);
    expect(coachNextStep(facts)).toBe("invite");
  });

  it("une étape avancée prouve les précédentes, sauf le profil", () => {
    // Une séance supprimée après validation ne fait pas reculer le guide.
    const facts = { ...empty, validations: 1 };
    expect(doneKeys(facts)).toEqual(["invite", "create", "publish", "validate"]);
    expect(coachNextStep(facts)).toBe("profile");
    expect(coachOnboardingDone(facts)).toBe(false);
    expect(coachOnboardingDone(finished)).toBe(true);
    expect(coachProgress(finished)).toEqual({ done: 5, total: 5 });
  });

  it("les e-mails visent la validation : la photo ne vaut pas un rappel", () => {
    expect(coachActivationStep(empty)).toBe("invite");
    expect(coachActivationStep({ ...empty, validations: 1 })).toBeNull();
    expect(coachActivationStep({ ...empty, profileComplete: true, invitations: 1 })).toBe("create");
  });

  it("une étape facultative est faite par les faits, ou écartée à la main", () => {
    const steps = coachOptionalSteps({ ...empty, videos: 1 }, ["phase", "video"]);
    expect(steps).toEqual([
      { key: "equipment", done: false, skipped: false },
      { key: "video", done: true, skipped: false },
      { key: "phase", done: false, skipped: true },
      { key: "install", done: false, skipped: false },
    ]);
  });
});

describe("carte, tour et fête", () => {
  it("la carte reste jusqu'à la fin des premiers pas, sauf refermée", () => {
    expect(coachGuideVisible(empty, fresh)).toBe(true);
    expect(coachGuideVisible({ ...empty, validations: 1 }, fresh)).toBe(true);
    expect(coachGuideVisible(empty, { ...fresh, dismissedAt: new Date() })).toBe(false);
    expect(coachGuideVisible(finished, fresh)).toBe(false);
  });

  it("un coach d'avant ce suivi garde l'ancienne règle et n'est pas guidé", () => {
    expect(coachGuideVisible(empty, null)).toBe(true);
    expect(coachGuideVisible({ ...empty, validations: 1 }, null)).toBe(false);
    expect(coachTourDue(null)).toBe(false);
    expect(coachCelebrationDue(finished, null)).toBe(false);
    expect(screenHintDue(null, "suivi")).toBe(false);
  });

  it("le tour s'ouvre une fois, la fête aussi", () => {
    expect(coachTourDue(fresh)).toBe(true);
    expect(coachTourDue({ ...fresh, tourSeenAt: new Date() })).toBe(false);
    expect(coachCelebrationDue(empty, fresh)).toBe(false);
    expect(coachCelebrationDue(finished, { ...fresh, dismissedAt: new Date() })).toBe(true);
    expect(coachCelebrationDue(finished, { ...fresh, celebratedAt: new Date() })).toBe(false);
  });

  it("un repère se montre une fois par écran", () => {
    expect(screenHintDue(fresh, "suivi")).toBe(true);
    expect(screenHintDue({ ...fresh, seenScreens: ["suivi"] }, "suivi")).toBe(false);
    expect(screenHintDue({ ...fresh, seenScreens: ["suivi"] }, "exercices")).toBe(true);
  });
});

describe("accueil de l'athlète", () => {
  it("un jour de séance, l'accueil se réduit à une ligne : la séance passe d'abord", () => {
    expect(athleteWelcomeMode({ eligible: true, welcomeSeenAt: null, sessionToday: true })).toBe("line");
    expect(athleteWelcomeMode({ eligible: true, welcomeSeenAt: null, sessionToday: false })).toBe("panels");
  });

  it("refermé ou hors de la première semaine, il ne revient pas", () => {
    expect(athleteWelcomeMode({ eligible: true, welcomeSeenAt: new Date(), sessionToday: false })).toBeNull();
    expect(athleteWelcomeMode({ eligible: false, welcomeSeenAt: null, sessionToday: false })).toBeNull();
  });

  it("la carte facultative attend la première validation", () => {
    expect(athleteExtrasVisible({ validations: 0, memory: fresh })).toBe(false);
    expect(athleteExtrasVisible({ validations: 1, memory: fresh })).toBe(true);
    expect(athleteExtrasVisible({ validations: 1, memory: { ...fresh, dismissedAt: new Date() } })).toBe(false);
    expect(athleteExtrasVisible({ validations: 1, memory: null })).toBe(false);
  });
});
