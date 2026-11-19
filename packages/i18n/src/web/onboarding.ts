// Les premiers pas, côté web : dernier temps de la création de l'espace, tour de piste, carte « Pour démarrer »,
// page des premiers pas, repères de première visite, fin des premiers pas, accueil de l'athlète.
// Les titres des étapes, que le mobile affichera aussi, sont dans `../fr.ts` (`m.firstSteps`).

export type FeatureKey = "suivi" | "calendrier" | "exercices" | "videos" | "planificateur" | "progression" | "annonces";

export const onboarding = {
  // Le dernier temps, facultatif, de la création de l'espace : l'espace existe déjà.
  invite: {
    stepName: "Ton groupe",
    title: "Invite tes premiers athlètes",
    lead: (group: string) =>
      `Ton espace est prêt. Partage le lien de ${group} : tes athlètes le rejoignent en une minute, sans rien installer.`,
    optional: "Facultatif : tu pourras inviter plus tard, depuis tes premiers pas.",
    linkLabel: "Lien d'invitation du groupe",
    linkLoading: "Préparation du lien du groupe",
    showQr: "Afficher le QR code",
    hideQr: "Masquer le QR code",
    qrLabel: (group: string) => `QR code pour rejoindre ${group}`,
    qrHint: "À montrer à la piste : il s'ouvre avec l'appareil photo du téléphone.",
    emailsLabel: "Ou par e-mail",
    emailsHint:
      "Une ou plusieurs adresses, séparées par une virgule ou un retour à la ligne. Chacun reçoit son invitation.",
    send: "Envoyer les invitations",
    sent: (count: number) => (count > 1 ? `${count} invitations envoyées` : "Invitation envoyée"),
    invalid: (list: string) => `Adresse à vérifier : ${list}`,
    tooMany: (max: number) => `${max} adresses au plus à la fois.`,
    empty: "Saisis au moins une adresse.",
    finish: "Ouvrir mon espace",
  },

  // Le tour de piste : une étape par grande fonction, refermable à tout moment, rouvrable ensuite.
  tour: {
    title: "Le tour de piste",
    description: "Sept fonctions, une phrase chacune. Tu peux le refermer et le revoir depuis l'aide.",
    progress: (step: number, total: number) => `Étape ${step} sur ${total}`,
    previous: "Précédent",
    next: "Suivant",
    finish: "Commencer",
    go: "Y aller",
    stepsLabel: "Étapes du tour",
    goToStep: (step: number, title: string) => `Étape ${step} : ${title}`,
    reopen: "Revoir le tour de piste",
    capture: "Capture du produit, sur des données fictives",
    preview: "Aperçu réel du guide animé d'une fiche de la bibliothèque",
    features: {
      suivi: {
        title: "Le suivi",
        body: "Une grille athlètes × séances : tu vois d'un coup d'œil qui a fait quoi, et tu relances les retardataires d'un geste.",
        alt: "Le suivi du groupe : la grille des athlètes et des séances de la semaine",
      },
      calendrier: {
        title: "Le calendrier et le constructeur",
        body: "Tu construis une séance une fois, avec circuits et supersets, et tu la publies pour le groupe ou pour quelques athlètes.",
        alt: "Le constructeur de séance, avec ses blocs et ses exercices",
      },
      exercices: {
        title: "Les exercices",
        body: "Une bibliothèque prête, un guide animé par fiche, et tes propres exercices rangés dans tes listes.",
        alt: "Le guide animé d'un exercice de la bibliothèque",
      },
      videos: {
        title: "La vidéo",
        body: "Tu revois un geste au ralenti et tu le commentes sur l'image, avec des tracés que l'athlète retrouve chez lui.",
        alt: "L'analyse d'une vidéo, avec la timeline des remarques",
      },
      planificateur: {
        title: "Le planificateur",
        body: "Tu décris ou tu dictes ta séance, il prépare un brouillon que tu relis. Il ne publie jamais seul.",
        alt: "Le planificateur, avant l'écriture d'une consigne",
      },
      progression: {
        title: "La progression et les phases",
        body: "Charges réalisées, records et phases de la saison se lisent au même endroit, avec leur provenance.",
        alt: "Les progrès d'un athlète : ses records et ses charges",
      },
      annonces: {
        title: "Les annonces",
        body: "Un message pour tout le groupe, épinglé en haut de leur écran, sans ouvrir de discussion.",
        alt: "La liste des annonces d'un groupe",
      },
    } satisfies Record<FeatureKey, { title: string; body: string; alt: string }>,
  },

  // La carte « Pour démarrer », sur le suivi et sur la page des premiers pas.
  guide: {
    lap: (done: number, total: number) =>
      done > 1 ? `${done} étapes faites sur ${total}` : `${done} étape faite sur ${total}`,
    next: "Prochaine étape",
    done: "Fait",
    close: "Refermer",
    closeLabel: "Refermer la carte des premiers pas",
    closed: "Carte refermée. Tes premiers pas restent dans le menu des réglages.",
    reopen: "Remettre la carte sur le suivi",
    reopened: "La carte est de retour sur le suivi.",
    all: "Tous les premiers pas",
    steps: {
      profile: {
        detail: "Une photo ou un avatar : tes athlètes te reconnaissent dès leur arrivée.",
        action: "Ajouter ma photo",
      },
      invite: {
        detail: "Le lien du groupe, un QR code à la piste ou quelques adresses e-mail.",
        action: "Inviter ici",
        hide: "Masquer l'invitation",
      },
      create: {
        detail: "Pars d'un modèle de ta bibliothèque, d'une page vierge ou du planificateur.",
        template: (title: string) => `Modèle : ${title}`,
        blank: "Page vierge",
        planner: "Planificateur",
      },
      publish: {
        detail: "Tant qu'elle reste en brouillon, ton groupe ne la voit pas.",
        action: "Ouvrir le calendrier",
      },
      validate: {
        detail:
          "Essaie avec ton propre téléphone : ouvre le lien du groupe avec une autre adresse e-mail, valide la séance du jour, et regarde la case se cocher ici.",
        action: "Afficher le lien et le QR code",
      },
    },
    optionalTitle: "Pour aller plus loin",
    optionalCount: (done: number, total: number) => `Facultatif, ${done} sur ${total}`,
    optional: {
      equipment: "Les modèles et le planificateur partent du matériel que tu as vraiment.",
      video: "Une vidéo d'athlète, revue au ralenti et commentée sur l'image.",
      phase: "Une phase de préparation situe chaque séance dans la saison.",
      install: "Sur ton téléphone, Tartan s'ouvre comme une app, avec les notifications.",
    },
    go: "Y aller",
    goTo: (title: string) => `Y aller : ${title}`,
    skip: "Écarter",
    skipLabel: (title: string) => `Écarter l'étape : ${title}`,
    unskip: "Reprendre",
    unskipLabel: (title: string) => `Reprendre l'étape : ${title}`,
    skipped: "Écartée",
  },

  // Un coach sans athlète : plus de grille vide, mais ce qu'il y a à faire.
  emptyGroup:
    "Personne dans ton groupe pour l'instant. Invite tes athlètes : la grille se remplit dès qu'ils valident.",
  emptyGroupAction: "Inviter mes athlètes",

  // La page des premiers pas : la référence, après le tour.
  page: {
    title: "Premiers pas",
    lead: "Ce que Tartan sait faire, et où en est ton espace.",
    stepsTitle: "Tes étapes",
    stepsDone: "Tes premiers pas sont bouclés.",
    featuresTitle: "Toutes les fonctions",
    inviteTitle: "Inviter tes athlètes",
    installTitle: "Installer l'app",
    installBody:
      "Sur téléphone, ouvre Tartan dans le navigateur puis choisis « Sur l'écran d'accueil » dans le menu de partage (iPhone) ou « Installer l'application » (Android). Sur ordinateur, l'icône d'installation est au bout de la barre d'adresse.",
    installDone: "Tartan est installé sur un de tes appareils.",
    state: {
      athletes: (count: number) =>
        count === 0 ? "Aucun athlète pour l'instant" : count > 1 ? `${count} athlètes` : "1 athlète",
      sessions: (count: number) =>
        count === 0 ? "Aucune séance publiée" : count > 1 ? `${count} séances publiées` : "1 séance publiée",
      exercises: (count: number) => (count > 1 ? `${count} exercices dans ta bibliothèque` : `${count} exercice`),
      videos: (count: number) => (count === 0 ? "Aucune vidéo" : count > 1 ? `${count} vidéos` : "1 vidéo"),
      planner: (available: boolean) => (available ? "Disponible pour ton espace" : "Pas inclus dans ton offre"),
      phases: (count: number) =>
        count === 0 ? "Aucune phase posée" : count > 1 ? `${count} phases posées` : "1 phase posée",
      announcements: (count: number) =>
        count === 0 ? "Aucune annonce" : count > 1 ? `${count} annonces` : "1 annonce",
    },
    // Derrière un drapeau éteint : l'espace de démonstration viendra dans un lot suivant.
    demo: "Voir un espace de démonstration",
  },

  // Le repère de première visite d'un écran : une phrase, refermable, une fois.
  hint: {
    label: "Repère de cet écran",
    close: "Refermer ce repère",
  },

  // La fin des premiers pas : un grand moment, une fois.
  celebration: {
    title: "Premiers pas bouclés",
    body: "Ton groupe a validé sa première séance et ton espace est prêt. La suite se passe dans le suivi.",
    action: "Continuer",
  },

  menu: "Premiers pas",
} as const;
