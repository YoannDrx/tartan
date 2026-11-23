import type {
  CoachOptionalStepKeyValue,
  CoachStepKeyValue,
  OnboardingPatch,
  OnboardingResponse,
} from "@tartan/contracts";
import { athleteWelcomeMode, type AthleteWelcomeMode } from "@tartan/domain";

// Les premiers pas dans l'app native : ce qu'un geste change à l'écran avant la réponse du serveur, où mène chaque
// étape, et ce que voit l'athlète en arrivant. L'état réel est celui du serveur (`/orgs/[orgId]/onboarding`).

// La même écriture que le serveur, appliquée tout de suite : la carte se referme au toucher, sans attendre.
export const applyOnboardingPatch = (
  state: OnboardingResponse,
  patch: OnboardingPatch,
  now: string,
): OnboardingResponse => {
  const next = { ...state };
  if (patch.tourSeen) {
    next.tourSeenAt = state.tourSeenAt ?? now;
    next.tourDue = false;
  }
  if (patch.welcomeSeen) next.welcomeSeenAt = state.welcomeSeenAt ?? now;
  if (patch.celebrated) {
    next.celebratedAt = state.celebratedAt ?? now;
    next.celebrationDue = false;
  }
  if (patch.dismissed === true) {
    next.dismissedAt = state.dismissedAt ?? now;
    next.guideVisible = false;
    next.extrasVisible = false;
  }
  if (patch.dismissed === false) {
    next.dismissedAt = null;
    // Le serveur recalcule ; une carte rouverte se montre tant que des étapes restent à faire.
    next.guideVisible = state.staff && state.steps.some((step) => !step.done);
  }
  const skipped = new Set(state.skipped);
  if (patch.skip) skipped.add(patch.skip);
  if (patch.unskip) skipped.delete(patch.unskip);
  if (patch.skip || patch.unskip) {
    next.skipped = [...skipped];
    next.optionalSteps = state.optionalSteps.map((step) => ({ ...step, skipped: skipped.has(step.key) }));
  }
  if (patch.seenScreen && !state.seenScreens.includes(patch.seenScreen)) {
    next.seenScreens = [...state.seenScreens, patch.seenScreen];
  }
  return next;
};

// La prochaine étape à faire, marquée dans la carte.
export const nextCoachStep = (state: Pick<OnboardingResponse, "steps">): CoachStepKeyValue | null =>
  state.steps.find((step) => !step.done)?.key ?? null;

export type AppRoute =
  | "/settings/profil"
  | "/settings/espace"
  | "/settings/notifications"
  | "/invite"
  | "/(coach)/planning"
  | "/(coach)/videos"
  | "/training-phases";

// Où mène chaque étape. Créer une séance ouvre le constructeur, une séance neuve.
export const COACH_STEP_ROUTES: Record<CoachStepKeyValue, AppRoute | "new-session"> = {
  profile: "/settings/profil",
  invite: "/invite",
  create: "new-session",
  publish: "/(coach)/planning",
  validate: "/invite",
};

export const COACH_OPTIONAL_ROUTES: Record<CoachOptionalStepKeyValue, AppRoute> = {
  equipment: "/settings/espace",
  video: "/(coach)/videos",
  phase: "/training-phases",
  // Sur le téléphone, l'app est déjà installée : il lui reste les notifications.
  install: "/settings/notifications",
};

// Les sept fonctions du tour de piste, dans l'ordre du web.
export const TOUR_FEATURES = [
  "suivi",
  "calendrier",
  "exercices",
  "videos",
  "planificateur",
  "progression",
  "annonces",
] as const;
export type TourFeature = (typeof TOUR_FEATURES)[number];

// L'athlète qui arrive : l'accueil ne retarde jamais la séance. Un jour de séance, une ligne sous elle ; sinon il
// ouvre l'écran. Rien quand l'accueil est passé (une semaine, une validation) ou refermé sur un autre appareil, ni pour
// un membre que le suivi ne guide pas (`guided = false` : arrivé avant lui, ou compte de démonstration de la graine).
export const athleteWelcomeView = (input: {
  guided: boolean | undefined;
  welcome: { group: string; coach: string } | null | undefined;
  welcomeSeenAt: string | null | undefined;
  sessionToday: boolean;
}): AthleteWelcomeMode =>
  athleteWelcomeMode({
    eligible: Boolean(input.guided && input.welcome),
    welcomeSeenAt: input.welcomeSeenAt ?? null,
    sessionToday: input.sessionToday,
  });
