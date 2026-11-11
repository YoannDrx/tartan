// Les premiers pas du coach : déduits de l'état réel de l'espace, jamais stockés.
// Le guide de l'écran de suivi et les e-mails d'activation lisent la même règle.

export type CoachOnboardingFacts = {
  invitations: number;
  athletes: number;
  sessions: number;
  publishedSessions: number;
  validations: number;
};

export type CoachStepKey = "invite" | "create" | "publish" | "validate";

export type CoachStep = { key: CoachStepKey; done: boolean };

export const COACH_STEPS: readonly CoachStepKey[] = ["invite", "create", "publish", "validate"];

// Une étape plus avancée prouve les précédentes : une séance publiée a forcément été créée.
export const coachChecklist = (facts: CoachOnboardingFacts): CoachStep[] => {
  const validated = facts.validations > 0;
  const published = validated || facts.publishedSessions > 0;
  const created = published || facts.sessions > 0;
  // Inviter suffit : l'étape n'attend pas que l'athlète ait accepté.
  const invited = validated || facts.athletes > 0 || facts.invitations > 0;
  return [
    { key: "invite", done: invited },
    { key: "create", done: created },
    { key: "publish", done: published },
    { key: "validate", done: validated },
  ];
};

export const coachNextStep = (facts: CoachOnboardingFacts): CoachStepKey | null =>
  coachChecklist(facts).find((step) => !step.done)?.key ?? null;

export const coachOnboardingDone = (facts: CoachOnboardingFacts): boolean => coachNextStep(facts) === null;

export const coachProgress = (facts: CoachOnboardingFacts): { done: number; total: number } => {
  const steps = coachChecklist(facts);
  return { done: steps.filter((step) => step.done).length, total: steps.length };
};
