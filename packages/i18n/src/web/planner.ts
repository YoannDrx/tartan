// Planificateur IA, écran web : la demande en un champ, puis la séance dans l'éditeur du constructeur.
// Tous les textes de cet écran sont ici. `fr.ts` ne garde que ce que l'app native et le serveur affichent.
type Step = "understand" | "match" | "compose" | "repair";
type LoadKind = "external_total" | "added_weight" | "assistance" | "bodyweight";
const plural = (n: number) => (n > 1 ? "s" : "");

export const planner = {
  title: "Planificateur IA (bêta)",
  beta: "Bêta · brouillons à relire",
  lead: "Écris ou dicte ce que tu veux. Tu relis la séance, puis tu crées un brouillon : rien n'est publié seul.",
  recent: "Mes propositions récentes",
  newProposal: "Préparer une nouvelle proposition",
  expiredRequest: "Cette demande a expiré. Crée une nouvelle demande pour reprendre.",
  stages: { request: "Demande", session: "Séance" },
  stage: (n: number, label: string) => `Étape ${n} sur 2 : ${label}`,
  quota: (left: number) => `${left} proposition${plural(left)} restante${plural(left)} ce mois-ci`,
  quotaExceeded: "Le quota IA de ce mois est atteint. Aucun dépassement payant n'est déclenché.",

  // ─── La demande ───────────────────────────────────────────────────────────────────────────────────────────
  who: "Pour qui ?",
  whoHint: "Un ou plusieurs groupes, ou des athlètes. Tu peux aussi les nommer dans ta demande.",
  athletes: (count: number) => (count ? `Athlètes · ${count} choisi${plural(count)}` : "Choisir des athlètes"),
  searchAthlete: "Chercher un athlète",
  moreAthletes: "Les 50 premiers athlètes sont affichés. Précise ta recherche pour retrouver les autres.",
  noRecipients: "Cet espace n'a encore ni groupe ni athlète : une séance a besoin d'un destinataire.",
  addRecipients: "Gérer les athlètes",
  when: "Quand ?",
  day: "Le",
  dayHint: "Si ta demande cite un autre jour, c'est lui qui compte.",
  field: "Décris ta séance, ou dis ce que tu veux travailler",
  fieldHint: "Exercices, séries, charges, ou seulement un objectif. Ni nom d'athlète ni donnée de santé.",
  examplesTitle: "Par exemple",
  examples: [
    {
      kind: "Une séance décrite",
      text: "Demain : squat arrière 4 séries de 6 à 80 %, fentes marchées 3 séries de 10, gainage 3 fois 45 secondes.",
    },
    { kind: "Un objectif", text: "Une séance de pliométrie de 45 minutes, sans matériel, pour préparer les appuis." },
    {
      kind: "Un mélange",
      text: "Jeudi : un échauffement que je te laisse composer, puis 5 fois 30 mètres départ debout, récupération 3 minutes.",
    },
  ],
  textLimit: (length: number, limit: number) =>
    `${length} caractères sur ${limit}. Raccourcis ta demande : rien n'est coupé à ta place.`,
  precise: "Préciser",
  preciseOptional: "facultatif",
  preciseHint: "Ce que ta demande dit déjà passe avant ces réglages.",
  time: "Heure",
  duration: "Durée",
  durationValue: (min: number) => `${min} min`,
  level: "Niveau",
  levels: { beginner: "Débutant", intermediate: "Intermédiaire", advanced: "Avancé" },
  equipment: "Matériel disponible",
  equipmentHint: "Repris du profil de ton espace. Change-le pour cette séance seulement.",
  phases: "Phases de préparation",
  prepare: "Préparer la séance",
  preparing: "Préparation en cours",

  // ─── La dictée, dans le champ ─────────────────────────────────────────────────────────────────────────────
  dictation: {
    start: "Dicter",
    stop: "Arrêter et transcrire",
    cancel: "Annuler la dictée",
    recover: "Vérifier la transcription",
    limit: "Trois minutes au plus.",
    progress: (seconds: number) =>
      `Enregistrement : ${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`,
    starting: "Préparation du micro…",
    finalizing: "Fin de l'enregistrement…",
    checkingAccess: "Vérification de l'accès à la dictée…",
    transcribing: "Transcription en cours…",
    checkingResult: "Vérification de la transcription…",
    ready: "Dictée ajoutée à ta demande. Relis-la avant de l'envoyer.",
    pending: "La transcription est encore en cours. Vérifie son résultat sans redicter.",
    interrupted: "La dictée s'est arrêtée quand tu as quitté la page. Le micro est coupé.",
    responseUnknown: "La transcription n'est pas confirmée. Vérifie son résultat avant de dicter à nouveau.",
    unsupported: "Ce navigateur ne permet pas la dictée. Écris ta demande, ou ouvre Tartan dans un navigateur récent.",
    denied: "Le micro n'est pas autorisé pour ce site. Écris ta demande, ou autorise le micro dans ton navigateur.",
    invalid: "Cet enregistrement est illisible ou trop long. Dicte de nouveau, en moins de trois minutes.",
    recordingFailed: "La dictée a été interrompue. Écris ta demande ou recommence.",
    failed: "La dictée n'a pas pu être transcrite. Écris ta demande ou dicte de nouveau.",
  },

  // ─── L'accord, donné une fois ─────────────────────────────────────────────────────────────────────────────
  consent: {
    title: "Avant ta première demande",
    body: "Ce que tu écris et le nom des exercices de ta bibliothèque sont envoyés à OpenAI, aux États-Unis, pour préparer des brouillons de séance que tu relis. Les noms des groupes et des athlètes choisis sont remplacés par des jetons.",
    dictation:
      "La dictée est transcrite par le même prestataire : l'enregistrement lui est transmis tel que tu le prononces, et Tartan ne le conserve pas. Cet accord vaut pour l'écrit comme pour la dictée : tu ne le redonnes pas à chaque fois.",
    health: "N'écris et ne dicte ni nom d'athlète, ni blessure, ni douleur, ni autre donnée de santé.",
    accept: "J'accepte et je continue",
    withdraw: "Retirer mon accord",
    withdrawHint: "Cet accord couvre ce que tu écris et ce que tu dictes au planificateur.",
  },
  paidOnly: "Le planificateur IA est réservé aux offres Coach et Club.",
  seeOffers: "Voir les offres",
  disabled: "Le planificateur IA n'est pas activé pour cet espace.",

  // ─── La préparation, en direct ────────────────────────────────────────────────────────────────────────────
  steps: {
    context: "Lecture de ta demande",
    matching: "Recherche de tes exercices dans la bibliothèque",
    model: "Écriture de la séance",
    checks: "Contrôle des dates, charges et exercices",
    retry: "Correction d'un point",
  },
  understood: "Ce que j'ai compris",
  // L'étape où une panne est survenue, dite à côté de sa cause.
  failedAt: (step: Step) =>
    ({
      understand: "Panne pendant la lecture de ta demande.",
      match: "Panne pendant la recherche de tes exercices.",
      compose: "Panne pendant l'écriture de la séance.",
      repair: "Panne pendant la correction de la séance.",
    })[step],
  failed: "La séance n'a pas pu être préparée. Cette demande n'est pas décomptée.",
  planTitle: "La séance s'écrit",
  closedTab: "Tu peux quitter la page : la séance sera prête à ton retour.",
  processing: "La préparation continue. Actualise pour voir la séance, sans consommer une autre proposition.",
  refresh: "Actualiser",

  // ─── Une question, seulement quand rien ne peut s'écrire ──────────────────────────────────────────────────
  questions: "Avant de continuer",
  answer: "Ta réponse",
  answerHint: "Réponds seulement à ce qui est demandé.",
  sendAnswer: "Envoyer ma réponse",
  questionLimit:
    "Les cinq réponses sont utilisées. Reprends ta demande en la précisant : elle comptera comme une nouvelle.",
  // Une question sur un exercice ne se pose plus à cet écran ; une proposition d'avant peut encore en porter une.
  exerciseQuestion: "Cite le nom exact de la fiche dans ta réponse, ou reprends ta demande.",

  // ─── La séance à relire ───────────────────────────────────────────────────────────────────────────────────
  request: "Ta demande",
  sessionTitle: "Ta séance à relire",
  sessionHint: "Modifie-la comme dans le constructeur. Rien n'est publié : un brouillon est créé.",
  loadingSession: "Mise en place de la séance…",
  assumptions: "Ce que j'ai supposé",
  editSchedule: "Modifier la date, les destinataires et le format",
  blockName: "Nom du bloc",
  preview: "Aperçu pour l'athlète",
  toCheck: "À vérifier",
  toCheckCount: (n: number) => `${n} point${plural(n)} à vérifier`,
  warnings: {
    approximate_exercise: (name: string | null) =>
      name
        ? `Fiche choisie par rapprochement : « ${name} ». Vérifie que c'est le bon mouvement.`
        : "Fiche choisie par rapprochement : vérifie le mouvement.",
    rest_not_executed: () =>
      "La récupération indiquée après la dernière série ne s'appliquera pas. Ajoute une récupération dans la séquence si besoin.",
    rounds_not_stated: (rounds: string | null) =>
      `${rounds ?? "Ce"} tour${rounds && Number(rounds) > 1 ? "s" : ""} : ce nombre n'est pas dans ta demande. Vérifie le groupe répété.`,
    rounds_missing: (rounds: string | null) =>
      `Ta demande parle de ${rounds ?? "plusieurs"} tours, absents de la séance. Vérifie le circuit.`,
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
  // Une fiche rapprochée : le terme du coach, la fiche posée, et les autres fiches en un geste.
  probable: {
    said: (said: string) => `Tu as dit « ${said} ».`,
    unsure: "Fiche rapprochée de ce que tu as dit.",
    others: "Ou plutôt",
    use: (name: string) => `Prendre ${name} à la place`,
    confirm: "C'est la bonne fiche",
    search: "Chercher une autre fiche",
    searchTitle: (said: string) => `Quelle fiche pour « ${said} » ?`,
    searchHint: "Toute ta bibliothèque. La fiche choisie garde les séries, les répétitions et la charge.",
    pick: (name: string) => `Prendre ${name}`,
    learned: (said: string, name: string) => `C'est noté : « ${said} » désigne ${name}.`,
  },
  // Un emplacement à compléter : l'exercice est à sa place, il lui manque sa fiche.
  slot: {
    label: "À compléter",
    name: (said: string) => `« ${said} »`,
    noFiche: "Aucune fiche ne porte ce nom dans ta bibliothèque.",
    noPrescription: "Prescription à compléter",
    choose: "Choisir une fiche",
    chooseFor: (said: string) => `Choisir une fiche pour « ${said} »`,
    create: "Créer la fiche",
    createFor: (said: string) => `Créer la fiche « ${said} »`,
    remove: "Retirer",
    removeFor: (said: string) => `Retirer « ${said} » de la séance`,
    title: (said: string) => `Compléter « ${said} »`,
    createTitle: (said: string) => `Créer la fiche « ${said} »`,
    hint: "La fiche choisie prend cette place, avec la prescription que tu as dite.",
    near: "Fiches proches",
    pick: (name: string) => `Utiliser ${name}`,
    backToSearch: "Chercher dans la bibliothèque",
    filled: (said: string, name: string) => `« ${said} » utilise maintenant ${name}. Le terme est retenu.`,
    removed: (said: string) => `« ${said} » est retiré de la séance.`,
    left: (n: number) => (n === 1 ? "1 exercice attend sa fiche." : `${n} exercices attendent leur fiche.`),
    loadsBlocked: "Complète d'abord les exercices sans fiche : les charges se calculent sur des fiches.",
  },
  replace: {
    action: "Remplacer l'exercice",
    title: (name: string) => `Remplacer ${name}`,
    hint: "Toute ta bibliothèque. Les séries, les répétitions, le repos et la charge restent ; un pourcentage se rapporte au maximum du nouvel exercice, et les charges adaptées par athlète pour cet exercice sont retirées.",
    pick: (name: string) => `Remplacer par ${name}`,
    done: (name: string) => `Exercice remplacé par ${name}.`,
  },
  added: (name: string) => `${name} ajouté à la séance.`,
  undo: "Annuler la dernière modification",
  unknownExercise: "Fiche introuvable",

  // ─── Les charges par athlète ──────────────────────────────────────────────────────────────────────────────
  loads: {
    open: "Vérifier les charges par athlète",
    hint: "Calculées par Tartan avec les références d'aujourd'hui, sans rien transmettre à l'IA. Les pourcentages seront recalculés à la publication.",
    updating: "Mise à jour des charges…",
    coverage: (from: number, to: number, total: number) =>
      total === 0
        ? "Aucun athlète dans ces destinataires pour l'instant."
        : total <= to && from === 1
          ? `${total} athlète${plural(total)}.`
          : `Athlètes ${from} à ${to} sur ${total}. Dix au plus par page.`,
    rows: "Charges par athlète",
    rowsHint: "Ouvre un athlète pour lire ses prescriptions et adapter ses charges.",
    rowSummary: (exercises: number, unresolved: number, customized: number) =>
      [
        `${exercises} exercice${plural(exercises)}`,
        ...(unresolved ? [`${unresolved} charge${plural(unresolved)} en % à définir`] : []),
        ...(customized ? [`${customized} adaptation${plural(customized)}`] : []),
      ].join(" · "),
    undefined: "Charge à définir : aucune référence de force pour cet exercice.",
    percent: (value: number, unit: string) => `${value} ${unit}`,
    percentUndefined: " · Charge à définir : aucune référence de force pour cet exercice.",
    reference: "Référence de force",
    source: (label: string, kilos: number, date: string) => `${label} : ${kilos} kg · ${date}`,
    adapt: "Adapter la charge pour cet athlète",
    reset: "Reprendre la charge commune",
    previous: "Athlètes précédents",
    next: "Athlètes suivants",
    noAutomatic:
      "Un pourcentage utilise la référence de l'athlète au moment de la publication. Sans référence, la charge reste à définir.",
    needed: "Ouvre les charges par athlète : des pourcentages seront convertis pour chacun.",
  },

  // ─── Ajuster, puis créer ──────────────────────────────────────────────────────────────────────────────────
  adjust: "Ajuster",
  adjustLabel: "Ce qui change",
  adjustHint: "Une modification à la fois. Ce que tu as retouché à la main est gardé. Sans quota supplémentaire.",
  adjustSend: "Ajuster la séance",
  adjustCount: (used: number, limit: number) => `${used} ajustement${plural(used)} sur ${limit}`,
  adjustLimit: "Les cinq ajustements sont utilisés. Modifie la séance directement ci-dessus.",
  edit: "Modifier la demande",
  create: "Créer le brouillon",
  createMany: (n: number) => `Créer ${n} brouillons`,
  creating: "Création du brouillon",
  // Tant qu'un exercice attend sa fiche, le bouton dit ce qui reste et y mène.
  complete: (n: number, said: string) => (n === 1 ? `Compléter « ${said} »` : `Compléter ${n} exercices`),
  draftsInvalid: "Un titre, un nom de bloc, une note ou une valeur est à corriger avant de créer le brouillon.",
  noPublication: "Seul un brouillon est créé : aucun athlète n'est prévenu, rien n'est publié.",
  created: "Brouillon créé. Ouvre-le pour le publier quand il te convient.",
  createdDraft: (index: number) => `Brouillon ${index}`,
  openDraft: (title: string) => `Ouvrir « ${title} »`,
  again: "Nouvelle demande",
  calendar: "Voir le calendrier",

  // ─── Les termes que l'espace a appris ─────────────────────────────────────────────────────────────────────
  aliases: {
    title: "Mes termes",
    count: (n: number) => (n === 0 ? "aucun" : `${n}`),
    hint: "Ce que tu dis, et la fiche que tu as choisie pour ce terme. Le planificateur et la dictée s'en servent, dans ton espace seulement.",
    empty:
      "Aucun terme pour l'instant. Ils s'ajoutent quand tu choisis une fiche pour un exercice que le planificateur n'a pas reconnu.",
    said: (said: string) => `« ${said} »`,
    means: "désigne",
    remove: "Retirer",
    removeFor: (said: string) => `Retirer le terme « ${said} »`,
    removed: (said: string) => `« ${said} » est retiré : il sera de nouveau cherché dans ta bibliothèque.`,
    loading: "Chargement de tes termes…",
    failed: "Tes termes ne se sont pas chargés. Vérifie la connexion, puis réessaie.",
    retry: "Réessayer",
  },

  // ─── Les propositions récentes ────────────────────────────────────────────────────────────────────────────
  proposals: {
    hint: "Tes demandes envoyées. Rouvrir un résultat ne consomme aucune proposition.",
    empty: "Aucune proposition à rouvrir.",
    retention:
      "Une proposition est gardée sept jours, ou 24 heures après la création du brouillon. Les séances créées restent dans le calendrier.",
    refresh: "Actualiser la liste",
    earlier: "Demandes précédentes",
    open: (from: string, to: string, status: string) =>
      from === to ? `Le ${from} · ${status}` : `Du ${from} au ${to} · ${status}`,
    sent: (date: string) => `Demande envoyée le ${date}`,
    states: {
      processing: "Préparation à vérifier",
      clarification: "Réponse attendue",
      proposal: "Séance à relire",
      failed: "Demande échouée",
      committed: "Brouillon créé",
    },
  },

  // ─── Les accès ────────────────────────────────────────────────────────────────────────────────────────────
  entry: {
    // Là où le coach crée une séance : l'autre façon de commencer.
    withPlanner: "Avec le planificateur",
    withPlannerHint: "Écris ou dicte ta séance : elle arrive ici, prête à relire.",
  },
  loadKinds: {
    external_total: "Charge totale",
    added_weight: "Lest ajouté",
    assistance: "Assistance",
    bodyweight: "Poids du corps",
  } satisfies Record<LoadKind, string>,
} as const;
