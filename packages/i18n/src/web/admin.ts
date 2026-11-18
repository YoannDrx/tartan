// Atelier d'administration : relecture des gestes animés.
export const admin = {
  movements: {
    // Où en est chaque geste : écrit à la main, relevé de l'ancien moteur, ou relevé mais à reprendre.
    levels: { ecrit: "Écrit à la main", releve: "Relevé", "a-reprendre": "À reprendre" },
    constraints: {
      limits: "amplitudes articulaires",
      ground: "sol",
      feet: "appuis des pieds",
      bar: "barre",
      holds: "tenues",
      loop: "boucle",
    },
    toRedo: (constraints: string) => `À reprendre : ${constraints}. Ce geste garde l'ancien moteur.`,
    // Les gestes du nouveau moteur forment une série de relecture à part : une famille déjà validée ne les couvre pas.
    newBatch: "Nouveau moteur : deux vues par geste",
    newBatchLead:
      "Chaque geste se lit de profil et de face, ou de dessus quand il se fait au sol. Un geste relevé reprend l'ancien geste avec le nouveau corps ; un geste écrit à la main a sa technique et sa dynamique.",
    newApproved: "Gestes du nouveau moteur validés",
    approveNew: (family: string) => `Valider les gestes du nouveau moteur : ${family}`,
    reopenNew: (family: string) => `Retirer la validation des gestes du nouveau moteur : ${family}`,
    oldBatch: "Ancien moteur : gestes à reprendre",
  },
} as const;
