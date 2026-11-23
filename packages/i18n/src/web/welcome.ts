// L'aiguillage d'un compte sans espace (`/bienvenue`) : coach, athlète autonome ou invitation, et la sortie du compte.
export const welcome = {
  // Sous l'aiguillage : un compte sans espace garde la main sur lui-même.
  account: {
    title: "Ton compte",
    signedInAs: "Connecté avec",
    deleteDetail:
      "Ton compte et ce qui s'y rattache sont supprimés. Tu n'as encore rejoint aucun espace : rien d'autre n'est touché.",
  },
} as const;
