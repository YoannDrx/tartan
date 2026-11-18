import type { CoachOptionalStepKey, CoachStepKey } from "@tartan/domain";

// Où se fait chaque étape des premiers pas. La carte « Pour démarrer », la page des premiers pas et les e-mails
// d'activation mènent aux mêmes endroits.
export const COACH_STEP_PATH: Record<CoachStepKey, string> = {
  profile: "/reglages/profil",
  // L'invitation se fait sur place, sans passer par les réglages.
  invite: "/premiers-pas#inviter",
  create: "/seances/nouvelle",
  publish: "/calendrier",
  validate: "/suivi",
};

export const COACH_OPTIONAL_PATH: Record<CoachOptionalStepKey, string> = {
  equipment: "/reglages/espace",
  video: "/videos",
  phase: "/phases",
  install: "/premiers-pas#installer",
};

export const FIRST_STEPS_PATH = "/premiers-pas";

// L'espace de démonstration n'est pas encore livré : le lien de la page des premiers pas reste éteint.
export const DEMO_SPACE_ENABLED = false as boolean;
