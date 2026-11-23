// L'athlète qui s'entraîne seul, dans son espace personnel : refus d'une fonction de coach, navigation, accueil,
// premiers pas, e-mails et partage de son historique avec un coach.
export const personal = {
  // Une fonction réservée à l'espace d'un coach, demandée dans un espace personnel.
  cut: "Ton espace personnel n'a que toi : cette fonction sert à coacher un groupe.",
  nav: { plan: "Planifier" },
  openSession: "Ouvrir ma séance",
  planSession: "Planifier une séance",
  // Aujourd'hui, sans séance : il planifie lui-même.
  todayEmpty:
    "Rien de prévu aujourd'hui. Planifie ta prochaine séance : un modèle, une page vierge ou le planificateur.",
  // Le panneau d'une séance du calendrier, dans l'espace personnel.
  calendar: {
    draft: "Brouillon : publie-la pour la retrouver dans ta journée.",
    published: "Publiée : elle t'attend dans ta journée.",
    edit: "Modifier",
    open: "Ouvrir ma séance",
    close: "Fermer",
  },
  // Progrès : il note lui-même ses tests de force.
  progress: {
    addTest: "Noter un test de force",
    testTitle: "Un test de force",
    testLead: "Ta charge maximale sur une répétition, ou sur trois, à une date : elle sert de référence à tes charges.",
    exercise: "Exercice",
    kind: "Type de test",
    value: "Charge (kg)",
    date: "Date",
    save: "Enregistrer le test",
    saved: "Test enregistré.",
  },
  // Les e-mails de l'athlète autonome, et celui que reçoit un coach quand un athlète lui partage son historique.
  // Aucun ne porte de donnée de santé.
  emails: {
    welcome: {
      subject: "Ton espace d'entraînement est prêt",
      body: "Tu planifies tes séances, tu les valides d'un geste, et tes progrès se construisent séance après séance. Tout reste à toi : personne d'autre ne voit ton espace.",
      tip: "Commence par une séance de départ : elle se modifie comme tu veux. Installe Tartan sur ton écran d'accueil pour l'ouvrir d'un geste.",
      cta: "Planifier ma première séance",
    },
    activation: {
      footer: "Tu reçois ces conseils parce que tu viens d'ouvrir ton espace d'entraînement sur Tartan.",
      help: "Une question ? Réponds simplement à cet e-mail.",
      steps: {
        plan: {
          subject: "Ta première séance t'attend",
          body: "Pars d'une séance de départ, d'une page vierge, ou décris-la au planificateur : elle sera prête en deux minutes.",
          cta: "Planifier une séance",
        },
        validate: {
          subject: "Ta séance est faite ? Valide-la",
          body: "Un geste suffit. Ta régularité et tes progrès partent de là.",
          cta: "Ouvrir ma journée",
        },
        measure: {
          subject: "Note une référence de force",
          body: "Un test de force, même ancien, sert de référence aux charges de tes séances.",
          cta: "Noter un test",
        },
      },
    },
    finishSignup: {
      subject: "Termine ton inscription sur Tartan",
      body: "Ton compte est créé, il ne manque qu'une étape : dis-nous si tu coaches un groupe, si tu t'entraînes seul, ou ouvre le lien d'invitation de ton coach.",
      cta: "Terminer mon inscription",
      ignore: "Tu as changé d'avis ? Ignore ce message : il n'y en aura pas d'autre. Tu peux aussi supprimer ton compte depuis cette page.",
    },
    historyShared: {
      subject: (athlete: string) => `${athlete} te partage son historique`,
      body: (athlete: string, scopes: string) =>
        `${athlete} vient de rejoindre ton groupe et te partage son historique d'entraînement personnel : ${scopes}. Tu le lis sur sa fiche, en lecture seule, tant qu'il le partage.`,
      cta: "Voir sa fiche",
    },
  },
  // Ses premiers pas : la même carte que celle du coach, avec ses étapes d'athlète.
  guide: {
    title: "Pour démarrer",
    progress: (done: number, total: number) => `${done} ${done > 1 ? "étapes faites" : "étape faite"} sur ${total}`,
    next: "Prochaine étape",
    done: "Fait",
    dismiss: "Refermer",
    restore: "Remettre la carte sur ta journée",
    steps: {
      plan: {
        title: "Planifier une séance",
        body: "Pars d'un modèle, d'une page vierge, ou décris-la au planificateur.",
        action: "Planifier",
      },
      validate: {
        title: "Valider ta séance",
        body: "Une fois faite, valide-la d'un geste : ta régularité et tes progrès en partent.",
        action: "Voir ma journée",
      },
      measure: {
        title: "Noter une référence de force",
        body: "Un test de force sert de référence aux charges de tes séances.",
        action: "Noter un test",
      },
      install: {
        title: "Installer l'app",
        body: "Tartan sur ton écran d'accueil : ta séance s'ouvre d'un geste, même hors ligne.",
        action: "Installer",
      },
    },
    templates: "Ou pars d'un modèle :",
    blank: "Page vierge",
    planner: "Avec le planificateur",
    pageTitle: "Premiers pas",
    pageLead: "Ton espace d'entraînement, pas à pas. Tout reste à toi : personne d'autre ne le voit.",
  },
} as const;
