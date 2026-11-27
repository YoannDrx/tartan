// L'aiguillage d'un compte sans espace (`/bienvenue`) : coach, athlète autonome ou invitation, et la sortie du compte.
export const welcome = {
  title: "Bienvenue sur Tartan",
  lead: "Dis-nous comment tu t'entraînes : on prépare ce qu'il te faut.",
  choicesLabel: "Comment utilises-tu Tartan ?",
  coach: {
    title: "Je suis coach",
    detail: "Je prépare les séances d'un groupe, je suis ce qui a été fait et j'analyse les gestes.",
  },
  solo: {
    title: "Je m'entraîne seul",
    detail: "Je planifie et je valide mes propres séances, gratuitement. Je pourrai rejoindre un coach plus tard.",
  },
  invite: {
    title: "J'ai un lien d'invitation",
    detail: "Mon coach m'a envoyé un lien ou un code pour rejoindre son groupe.",
    label: "Lien ou code d'invitation",
    hint: "Colle le lien reçu, ou le code qui suit « /i/ » dans ce lien.",
    open: "Ouvrir l'invitation",
    invalid: "Ce lien ou ce code n'est pas reconnu. Copie-le en entier depuis le message de ton coach.",
  },
  // Inscriptions des coachs fermées : le choix reste visible, avec ce qu'il faut faire.
  coachClosed: "Tartan ouvre progressivement aux coachs. Écris-nous pour rejoindre les prochains :",
  // Réglage de la console fermé : l'athlète autonome ne peut pas ouvrir son espace pour l'instant.
  athleteClosed:
    "Tartan n'ouvre pas encore d'espace personnel aux athlètes. Si ton coach t'a envoyé un lien, ouvre-le pour rejoindre son groupe.",
  back: "Revenir aux trois choix",
  // Sous l'aiguillage : un compte sans espace garde la main sur lui-même.
  account: {
    title: "Ton compte",
    signedInAs: "Connecté avec",
    deleteDetail:
      "Ton compte et ce qui s'y rattache sont supprimés. Tu n'as encore rejoint aucun espace : rien d'autre n'est touché.",
  },
  // Le parcours « Je m'entraîne seul » : trois temps, comme celui du coach.
  soloForm: {
    title: "Ton espace d'entraînement",
    lead: "Gratuit, sans coach : tu planifies et tu valides tes propres séances.",
    stepsLabel: "Étapes de création de ton espace",
    steps: { start: "À vos marques", ready: "Prêts", go: "Partez" },
    profileTitle: "Toi",
    trainingTitle: "Ton entraînement",
    trainingHint: "Facultatif : tes disciplines et tes objectifs aident le planificateur à te proposer des séances.",
    termsTitle: "Les conditions",
    termsLead:
      "Ton espace n'est visible que par toi. Si tu rejoins un coach un jour, tu choisiras ce que tu partages avec lui.",
    consentHealthWhy:
      "Sert à noter ton effort ressenti et une douleur après la séance. Personne d'autre ne le voit dans ton espace.",
    consentVideoWhy: "Sert à filmer et revoir tes gestes. Tes vidéos restent dans ton espace.",
    create: "Ouvrir mon espace",
    quotas: "Gratuit : 5 propositions du planificateur, 10 minutes de dictée et 4 vidéos par mois.",
  },
  // L'athlète d'un club ouvre son carnet pour planifier lui-même (décision du 27 novembre 2026).
  notebookForm: {
    title: "Ton carnet personnel",
    lead: "Planifie tes propres séances avec le planificateur, à côté de ton club.",
    termsLead:
      "Ton carnet n'est visible que par toi : ton coach ne voit ni ces séances ni tes demandes au planificateur.",
    create: "Ouvrir mon carnet",
    back: "Revenir à ma journée",
  },
} as const;
