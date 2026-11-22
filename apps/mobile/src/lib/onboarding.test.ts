import type { OnboardingResponse } from "@tartan/contracts";
import { describe, expect, it } from "vitest";
import {
  applyOnboardingPatch,
  athleteWelcomeView,
  COACH_OPTIONAL_ROUTES,
  COACH_STEP_ROUTES,
  nextCoachStep,
  TOUR_FEATURES,
} from "./onboarding";

const NOW = "2026-11-22T10:00:00.000Z";

const coach = (over: Partial<OnboardingResponse> = {}): OnboardingResponse => ({
  guided: true,
  staff: true,
  tourSeenAt: null,
  welcomeSeenAt: null,
  dismissedAt: null,
  celebratedAt: null,
  skipped: [],
  seenScreens: [],
  steps: [
    { key: "profile", done: true },
    { key: "invite", done: false },
    { key: "create", done: false },
    { key: "publish", done: false },
    { key: "validate", done: false },
  ],
  optionalSteps: [
    { key: "equipment", done: false, skipped: false },
    { key: "video", done: false, skipped: false },
    { key: "phase", done: false, skipped: false },
    { key: "install", done: false, skipped: false },
  ],
  progress: { done: 1, total: 5 },
  guideVisible: true,
  tourDue: true,
  celebrationDue: false,
  extrasVisible: false,
  ...over,
});

describe("un geste des premiers pas, avant la réponse du serveur", () => {
  it("refermer la carte la retire, la rouvrir la rend tant qu'il reste des étapes", () => {
    const closed = applyOnboardingPatch(coach(), { dismissed: true }, NOW);
    expect(closed).toMatchObject({ dismissedAt: NOW, guideVisible: false });
    expect(applyOnboardingPatch(closed, { dismissed: false }, NOW)).toMatchObject({
      dismissedAt: null,
      guideVisible: true,
    });
    const done = coach({ steps: coach().steps.map((step) => ({ ...step, done: true })), dismissedAt: NOW });
    expect(applyOnboardingPatch(done, { dismissed: false }, NOW).guideVisible).toBe(false);
  });

  it("le tour vu ne revient pas, et une date déjà posée reste la première", () => {
    expect(applyOnboardingPatch(coach(), { tourSeen: true }, NOW)).toMatchObject({ tourSeenAt: NOW, tourDue: false });
    const earlier = "2026-11-20T08:00:00.000Z";
    expect(applyOnboardingPatch(coach({ welcomeSeenAt: earlier }), { welcomeSeen: true }, NOW).welcomeSeenAt).toBe(
      earlier,
    );
  });

  it("écarter puis reprendre une étape facultative", () => {
    const skipped = applyOnboardingPatch(coach(), { skip: "video" }, NOW);
    expect(skipped.skipped).toEqual(["video"]);
    expect(skipped.optionalSteps.find((step) => step.key === "video")?.skipped).toBe(true);
    const back = applyOnboardingPatch(skipped, { unskip: "video" }, NOW);
    expect(back.skipped).toEqual([]);
    expect(back.optionalSteps.every((step) => !step.skipped)).toBe(true);
  });

  it("la carte facultative de l'athlète se referme pour de bon", () => {
    const athlete = coach({ staff: false, steps: [], optionalSteps: [], guideVisible: false, extrasVisible: true });
    expect(applyOnboardingPatch(athlete, { dismissed: true }, NOW)).toMatchObject({ extrasVisible: false });
  });

  it("un repère vu ne s'ajoute qu'une fois", () => {
    const seen = applyOnboardingPatch(coach(), { seenScreen: "suivi" }, NOW);
    expect(applyOnboardingPatch(seen, { seenScreen: "suivi" }, NOW).seenScreens).toEqual(["suivi"]);
  });
});

describe("les étapes du coach", () => {
  it("la prochaine étape est la première qui reste à faire", () => {
    expect(nextCoachStep(coach())).toBe("invite");
    expect(nextCoachStep({ steps: coach().steps.map((step) => ({ ...step, done: true })) })).toBeNull();
  });

  it("chaque étape, obligatoire ou facultative, mène à un écran de l'app", () => {
    expect(Object.keys(COACH_STEP_ROUTES).sort()).toEqual(["create", "invite", "profile", "publish", "validate"]);
    expect(Object.keys(COACH_OPTIONAL_ROUTES).sort()).toEqual(["equipment", "install", "phase", "video"]);
    expect(TOUR_FEATURES).toHaveLength(7);
  });
});

describe("l'accueil de l'athlète", () => {
  const welcome = { group: "Hauteur Élite", coach: "Thomas" };
  it("ne passe jamais devant la séance du jour", () => {
    expect(athleteWelcomeView({ welcome, welcomeSeenAt: null, sessionToday: true })).toBe("line");
    expect(athleteWelcomeView({ welcome, welcomeSeenAt: null, sessionToday: false })).toBe("panels");
  });

  it("disparaît une fois refermé sur un appareil, ou quand l'accueil n'a plus lieu d'être", () => {
    expect(athleteWelcomeView({ welcome, welcomeSeenAt: NOW, sessionToday: false })).toBeNull();
    expect(athleteWelcomeView({ welcome: null, welcomeSeenAt: null, sessionToday: false })).toBeNull();
    expect(athleteWelcomeView({ welcome: undefined, welcomeSeenAt: undefined, sessionToday: true })).toBeNull();
  });
});
