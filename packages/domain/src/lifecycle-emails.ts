import { coachNextStep, type CoachOnboardingFacts, type CoachStepKey } from "./onboarding";

// Les e-mails d'activation du coach : trois rappels au plus, chacun sur la prochaine étape manquante.
// La décision est pure : la tâche planifiée fournit les faits, la file fait l'envoi.

export type ActivationDay = 1 | 3 | 7;

export type ActivationEmail = { day: ActivationDay; step: CoachStepKey; dedupeKey: string };

const DAY_MS = 86_400_000;

// Chaque échéance a une fenêtre en jours depuis la création de l'espace. Passée la fenêtre, rien ne part :
// après une panne de la tâche, un rappel en retard n'aurait plus de sens.
const WINDOWS: readonly { day: ActivationDay; from: number; to: number }[] = [
  { day: 1, from: 1, to: 2 },
  { day: 3, from: 3, to: 5 },
  { day: 7, from: 7, to: 10 },
];

export const ACTIVATION_WINDOW_DAYS = 10;

export const activationEmailFor = (
  space: { id: string; createdAt: Date; facts: CoachOnboardingFacts },
  now: Date,
): ActivationEmail | null => {
  const step = coachNextStep(space.facts);
  if (!step) return null;
  const age = (now.getTime() - space.createdAt.getTime()) / DAY_MS;
  const window = WINDOWS.find((entry) => age >= entry.from && age < entry.to);
  if (!window) return null;
  // Une clé par espace et par échéance : la tâche peut repasser dans la fenêtre sans doubler l'envoi.
  return { day: window.day, step, dedupeKey: `activation:${space.id}:${window.day}` };
};

// Proche du plafond : à partir de 80 % d'une limite, et seulement pour une limite qui vaut d'être annoncée.
export const NEAR_LIMIT_RATIO = 0.8;

export const isNearLimit = (limit: number | null, used: number): boolean =>
  limit !== null && limit >= 5 && used < limit && used >= Math.ceil(limit * NEAR_LIMIT_RATIO);
