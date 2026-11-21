// Les premiers pas du coach : déduits de l'état réel de l'espace, jamais stockés.
// La carte « Pour démarrer », la page des premiers pas et les e-mails d'activation lisent la même règle.
// Seul ce que les faits ne disent pas est gardé, par membre et par espace : tour vu, carte refermée,
// étapes facultatives écartées, repères vus (`OnboardingState`).

export type CoachOnboardingFacts = {
  // Une photo ou un avatar : le visage que les athlètes reconnaîtront dans leur accueil.
  profileComplete: boolean;
  invitations: number;
  athletes: number;
  sessions: number;
  publishedSessions: number;
  validations: number;
  // Étapes facultatives.
  equipment: number;
  videos: number;
  phases: number;
  installed: boolean;
};

export type CoachStepKey = "profile" | "invite" | "create" | "publish" | "validate";
export type CoachOptionalStepKey = "equipment" | "video" | "phase" | "install";

export type CoachStep = { key: CoachStepKey; done: boolean };
export type CoachOptionalStep = { key: CoachOptionalStepKey; done: boolean; skipped: boolean };

export const COACH_STEPS: readonly CoachStepKey[] = ["profile", "invite", "create", "publish", "validate"];
export const COACH_OPTIONAL_STEPS: readonly CoachOptionalStepKey[] = ["equipment", "video", "phase", "install"];

export const isCoachOptionalStep = (value: string): value is CoachOptionalStepKey =>
  (COACH_OPTIONAL_STEPS as readonly string[]).includes(value);

// Une étape plus avancée prouve les précédentes : une séance publiée a forcément été créée.
export const coachChecklist = (facts: CoachOnboardingFacts): CoachStep[] => {
  const validated = facts.validations > 0;
  const published = validated || facts.publishedSessions > 0;
  const created = published || facts.sessions > 0;
  // Inviter suffit : l'étape n'attend pas que l'athlète ait accepté.
  const invited = validated || facts.athletes > 0 || facts.invitations > 0;
  return [
    { key: "profile", done: facts.profileComplete },
    { key: "invite", done: invited },
    { key: "create", done: created },
    { key: "publish", done: published },
    { key: "validate", done: validated },
  ];
};

// Les étapes facultatives : faites d'après les faits, ou écartées à la main.
export const coachOptionalSteps = (
  facts: CoachOnboardingFacts,
  skipped: readonly string[] = [],
): CoachOptionalStep[] => {
  const done: Record<CoachOptionalStepKey, boolean> = {
    equipment: facts.equipment > 0,
    video: facts.videos > 0,
    phase: facts.phases > 0,
    install: facts.installed,
  };
  return COACH_OPTIONAL_STEPS.map((key) => ({ key, done: done[key], skipped: !done[key] && skipped.includes(key) }));
};

export const coachNextStep = (facts: CoachOnboardingFacts): CoachStepKey | null =>
  coachChecklist(facts).find((step) => !step.done)?.key ?? null;

// Les e-mails visent ce qui mène à la première validation, dans l'ordre de la carte. La photo ne vaut pas un
// e-mail : un coach dont un athlète a validé est activé, et ne reçoit plus de rappel.
export const coachActivationStep = (facts: CoachOnboardingFacts): CoachStepKey | null =>
  coachChecklist(facts).find((step) => !step.done && step.key !== "profile")?.key ?? null;

export const coachOnboardingDone = (facts: CoachOnboardingFacts): boolean => coachNextStep(facts) === null;

export const coachProgress = (facts: CoachOnboardingFacts): { done: number; total: number } => {
  const steps = coachChecklist(facts);
  return { done: steps.filter((step) => step.done).length, total: steps.length };
};

// Ce qui est gardé pour un membre. `null` : membre arrivé avant ce suivi, qui n'est pas un nouveau venu.
export type OnboardingMemory = {
  tourSeenAt: Date | string | null;
  welcomeSeenAt: Date | string | null;
  dismissedAt: Date | string | null;
  celebratedAt: Date | string | null;
  skipped: readonly string[];
  seenScreens: readonly string[];
};

// La carte « Pour démarrer » : jusqu'à la fin des premiers pas, sauf si le coach l'a refermée.
// Un coach d'avant ce suivi la garde comme avant : jusqu'à sa première validation.
export const coachGuideVisible = (facts: CoachOnboardingFacts, memory: OnboardingMemory | null): boolean => {
  if (coachOnboardingDone(facts)) return false;
  if (!memory) return facts.validations === 0;
  return !memory.dismissedAt;
};

// Le tour de piste s'ouvre seul une fois, à l'arrivée d'un nouveau coach.
export const coachTourDue = (memory: OnboardingMemory | null): boolean => Boolean(memory && !memory.tourSeenAt);

// La fin des premiers pas se fête une fois, même si la carte a été refermée en route.
export const coachCelebrationDue = (facts: CoachOnboardingFacts, memory: OnboardingMemory | null): boolean =>
  Boolean(memory && !memory.celebratedAt && coachOnboardingDone(facts));

// Un repère de première visite : une fois par écran, pour un nouveau venu.
export const screenHintDue = (memory: OnboardingMemory | null, screen: string): boolean =>
  Boolean(memory && !memory.seenScreens.includes(screen));

// L'accueil de l'athlète. Il ne retarde jamais la séance : un jour de séance, il se réduit à une ligne sous elle.
export type AthleteWelcomeMode = "panels" | "line" | null;

export const athleteWelcomeMode = (input: {
  // Première semaine et aucune séance validée.
  eligible: boolean;
  welcomeSeenAt: Date | string | null;
  sessionToday: boolean;
}): AthleteWelcomeMode => {
  if (!input.eligible || input.welcomeSeenAt) return null;
  return input.sessionToday ? "line" : "panels";
};

// Après la première validation : photo, mot de passe, installation et notifications, en une carte facultative.
// Un athlète d'avant ce suivi ne la voit pas : il connaît déjà l'app.
export const athleteExtrasVisible = (input: { validations: number; memory: OnboardingMemory | null }): boolean =>
  input.validations > 0 && Boolean(input.memory && !input.memory.dismissedAt);
