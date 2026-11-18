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
  // Les vidéos des fiches communes du catalogue, déposées par le fondateur.
  catalogVideos: {
    lead: "Une vidéo par fiche commune et par vue, profil ou face. Une fois prête, la fiche propose le geste animé ou la vidéo, à tous les espaces. Un nouvel envoi remplace l'ancien.",
    search: "Chercher une fiche",
    count: (shown: number, total: number) => `${shown} fiches sur ${total}`,
    withVideo: (n: number) => `${n} vidéo${n > 1 ? "s" : ""} prête${n > 1 ? "s" : ""}`,
    status: {
      none: "Aucune vidéo",
      uploading: "En cours d'envoi",
      ready: "Vidéo prête",
      error: "Envoi échoué",
    },
    choose: (view: string) => `Déposer la vidéo de ${view.toLowerCase()}`,
    replace: (view: string) => `Remplacer la vidéo de ${view.toLowerCase()}`,
    remove: (view: string) => `Retirer la vidéo de ${view.toLowerCase()}`,
    removeTitle: (name: string, view: string) => `Retirer la vidéo de ${view.toLowerCase()} de « ${name} » ?`,
    removeBody: "La fiche revient au seul geste animé. La vidéo est effacée chez Mux.",
    progress: (name: string, view: string) => `Envoi de la vidéo de ${view.toLowerCase()} : ${name}`,
    sent: "Vidéo envoyée. Elle apparaît sur la fiche dès que Mux l'a préparée.",
    removed: "Vidéo retirée.",
    failed: "L'envoi a échoué. Réessaie avec le même fichier.",
    disabled: "La vidéo n'est pas configurée sur cet environnement : aucun envoi possible.",
    empty: "Aucune fiche ne correspond.",
  },
} as const;
