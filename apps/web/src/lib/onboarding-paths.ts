import type { CoachOptionalStepKey, CoachStepKey, PersonalStepKey } from "@tartan/domain";

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

// Les premiers pas de l'athlète autonome : la carte de sa journée, sa page et ses e-mails mènent aux mêmes endroits.
export const PERSONAL_STEP_PATH: Record<PersonalStepKey, string> = {
  plan: "/seances/nouvelle",
  validate: "/aujourdhui",
  measure: "/progres#test-de-force",
  install: "/premiers-pas#installer",
};

// L'espace de démonstration s'ouvre depuis la page des premiers pas ; la carte « Pour démarrer » y mène.
export const DEMO_SPACE_ENABLED = true as boolean;
export const DEMO_SPACE_PATH = `${FIRST_STEPS_PATH}#demonstration`;

// L'athlète d'un club sans carnet : l'ouverture de son carnet, qui ramène au planificateur.
export const NOTEBOOK_FOR_PLANNER = "/bienvenue/seul?ensuite=planificateur";
