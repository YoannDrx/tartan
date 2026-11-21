// Planificateur IA, écran web en deux temps : la demande, puis la séance dans l'éditeur du constructeur.
export const planner = {
  stages: { request: "Demande", session: "Séance" },
  stage: (n: number, label: string) => `Étape ${n} sur 2 : ${label}`,
  who: "Pour qui ?",
  whoHint: "Un ou plusieurs groupes, ou des athlètes.",
  athletes: (count: number) => (count ? `Athlètes · ${count} choisi${count > 1 ? "s" : ""}` : "Choisir des athlètes"),
  when: "Quand ?",
  day: "Le",
  span: "Sur",
  spans: { day: "Une journée", week: "Sept jours" },
  time: "Heure (facultative)",
  how: "Que veux-tu ?",
  modes: {
    format: {
      title: "Mettre en forme ma séance",
      detail: "Tu écris ou dictes ta séance, l'IA la range dans le constructeur sans rien changer.",
    },
    propose: {
      title: "Proposer une séance",
      detail: "Tu donnes l'objectif, l'IA propose une séance du catalogue validé, sans charge en kilos.",
    },
  },
  instructions: "Ta séance",
  instructionsHint:
    "Jours, exercices, séries, répétitions, récupération, charges. Ni nom d'athlète ni donnée de santé.",
  objective: "Objectif",
  objectiveHint: "Ce que la séance doit travailler.",
  duration: "Durée",
  durationValue: (min: number) => `${min} min`,
  level: "Niveau",
  equipment: "Matériel disponible",
  equipmentHint:
    "Repris du profil de l'espace. Sans matériel coché, seuls les exercices au poids du corps sont proposés.",
  phases: "Phases de préparation",
  prepare: "Préparer la séance",
  preparing: "Préparation en cours",
  quota: (left: number) => `${left} proposition${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""} ce mois-ci`,
  steps: {
    context: "Lecture de ta demande",
    matching: "Recherche de tes exercices dans la bibliothèque",
    model: "Écriture de la séance",
    checks: "Contrôle des dates, charges et exercices",
    retry: "Correction d'un point",
  },
  understood: "Ce que j'ai compris",
  // L'étape où une panne est survenue, dite à côté de sa cause.
  failedAt: (step: "understand" | "match" | "compose" | "repair") =>
    ({
      understand: "Panne pendant la lecture de ta demande.",
      match: "Panne pendant la recherche de tes exercices.",
      compose: "Panne pendant l'écriture de la séance.",
      repair: "Panne pendant la correction de la séance.",
    })[step],
  planTitle: "La séance s'écrit",
  closedTab: "Tu peux quitter la page : la séance sera prête à ton retour.",
  questions: "Avant de continuer",
  answer: "Ta réponse",
  answerHint: "Réponds seulement à ce qui est demandé.",
  sendAnswer: "Envoyer ma réponse",
  sessionTitle: "Ta séance à relire",
  sessionHint: "Modifie-la comme dans le constructeur. Rien n'est publié : un brouillon est créé.",
  toCheck: "À vérifier",
  toCheckCount: (n: number) => `${n} point${n > 1 ? "s" : ""} à vérifier`,
  warnings: {
    approximate_exercise: (name: string | null) =>
      name
        ? `Fiche choisie par rapprochement : « ${name} ». Vérifie que c'est le bon mouvement.`
        : "Fiche choisie par rapprochement : vérifie le mouvement.",
    rest_not_executed: () =>
      "La récupération indiquée après la dernière série ne s'appliquera pas. Ajoute une récupération dans la séquence si besoin.",
    rounds_not_stated: (rounds: string | null) =>
      `${rounds ?? "Ce"} tour${rounds && Number(rounds) > 1 ? "s" : ""} : ce nombre n'est pas dans ta consigne. Vérifie le groupe répété.`,
    rounds_missing: (rounds: string | null) =>
      `Ta consigne parle de ${rounds ?? "plusieurs"} tours, absents de la séance. Vérifie le circuit.`,
    habit_load: () => "Charge habituelle : vérifie la valeur.",
    habit_rest: () => "Récupération habituelle : vérifie la durée.",
    load_unclear: (value: string | null) =>
      value
        ? `Charge laissée vide : « ${value} » est dit sans unité, ou n'a pas été retrouvé dans ta demande. Indique des kilos ou un pourcentage.`
        : "Charge laissée vide : indique des kilos ou un pourcentage.",
    unit_assumed: (value: string | null) =>
      `${value ?? "Un nombre"} est dit sans unité : rangé selon l'unité de la fiche. Vérifie la quantité.`,
    to_complete: () => "Exercice posé sans sa prescription : complète les séries et les répétitions.",
  },
  alternatives: (names: string[]) => `Autres fiches possibles : ${names.join(", ")}.`,
  adjust: "Ajuster",
  adjustLabel: "Ce qui change",
  adjustHint: "Une modification à la fois : un exercice, un volume, une récupération. Sans quota supplémentaire.",
  adjustSend: "Ajuster la séance",
  adjustCount: (used: number, limit: number) => `${used} ajustement${used > 1 ? "s" : ""} sur ${limit}`,
  adjustLimit: "Les cinq ajustements sont utilisés. Modifie la séance directement ci-dessous.",
  edit: "Modifier la demande",
  date: "Date",
  recipients: "Destinataires",
  create: "Créer le brouillon",
  createMany: (n: number) => `Créer ${n} brouillons`,
  creating: "Création du brouillon",
  loadsFirst: "Ouvre l'aperçu des charges : des pourcentages seront convertis pour chaque athlète.",
  created: "Brouillon créé. Ouvre-le pour le publier quand il te convient.",
  openDraft: (title: string) => `Ouvrir « ${title} »`,
  again: "Nouvelle demande",
  retry: "Réessayer",
  circuit: "Circuit",
} as const;
