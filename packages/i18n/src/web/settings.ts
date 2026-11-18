// Les réglages de la web app : le sommaire, ses rubriques, et les textes des formulaires.
// Les textes que le mobile affiche aussi restent dans `../fr.ts` (`m.settings.*`).
const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;

export const settings = {
  account: "Mon compte",
  // L'aide de l'écran, pour le sommaire et ses rubriques.
  screenHelp: [
    "Chaque rubrique a sa page : ton profil, ta connexion, tes notifications, l'apparence et la confidentialité.",
    "L'export de tes données et la suppression du compte sont dans Confidentialité.",
  ],
  rubrics: {
    profil: { title: "Profil" },
    connexion: { title: "Connexion", summary: "Mot de passe, appareils, déconnexion" },
    notifications: {
      title: "Notifications",
      summary: "Push, catégories, e-mails",
      summaryAthlete: "Push, catégories, e-mails, agenda",
    },
    apparence: { title: "Apparence", summary: (theme: string) => `Thème : ${theme}` },
    confidentialite: {
      title: "Confidentialité",
      summary: "Données, blocages, suppression du compte",
      summaryAthlete: "Accords, données, suppression du compte",
    },
    espace: {
      title: "Espace",
      summary: "Nom, logo, profil d'entraînement",
      summaryReports: (count: number) => `${plural(count, "signalement", "signalements")} à traiter`,
    },
    groupes: {
      title: "Groupes",
      summary: (count: number) => (count === 0 ? "Aucun groupe" : plural(count, "groupe", "groupes")),
    },
    membres: {
      title: "Membres",
      summary: (coaches: number | null, pending: number) =>
        [
          coaches === null ? null : plural(coaches, "coach", "coachs"),
          pending > 0 ? plural(pending, "invitation en cours", "invitations en cours") : null,
        ]
          .filter(Boolean)
          .join(", ") || "Inviter par e-mail ou par SMS",
    },
    abonnement: { title: "Abonnement", summary: (plan: string) => `Offre ${plan}` },
    aide: { title: "Aide", summary: "Centre d'aide, contact, nouveautés" },
  },
  profil: {
    section: "Mes informations",
    saved: "Profil enregistré.",
    units: "Unités",
    kg: "kg",
    lb: "lb",
    avatarAlt: (name: string) => `Photo de ${name}`,
  },
  connexion: {
    methods: "Mes moyens de connexion",
    link: "Lien par e-mail",
    linkState: "Toujours disponible",
    password: "Mot de passe",
    passwordOn: "Défini",
    passwordOff: "Aucun",
    google: "Google",
    apple: "Apple",
    linked: "Relié à ce compte",
    notLinked: "Pas encore utilisé",
    define: {
      title: "Définir un mot de passe",
      detail:
        "Avec un mot de passe, tu te connectes tout de suite, sans passer par ta boîte mail. Le lien par e-mail reste disponible.",
      field: "Nouveau mot de passe",
      submit: "Définir mon mot de passe",
      done: "Mot de passe défini.",
      // La session n'est pas assez récente : rien n'est enregistré avant la confirmation.
      confirmLead:
        "Tu es connecté depuis un moment. Pour ta sécurité, confirme d'abord que c'est bien toi avec un lien reçu par e-mail : tu reviendras ici pour choisir ton mot de passe.",
      confirmCta: "Recevoir le lien de confirmation",
      confirmSent: (email: string) =>
        `Le lien vient de partir vers ${email}. Ouvre-le sur cet appareil. Il reste valable 15 minutes.`,
      confirmed: "C'est bien toi. Choisis maintenant ton mot de passe.",
    },
    change: {
      title: "Changer le mot de passe",
      current: "Mot de passe actuel",
      next: "Nouveau mot de passe",
      revoke: "Déconnecter mes autres appareils",
      revokeDetail: "Cet appareil reste connecté.",
      submit: "Changer mon mot de passe",
      done: "Mot de passe changé.",
      doneRevoked: "Mot de passe changé. Tes autres appareils sont déconnectés.",
      forgot: "Mot de passe oublié ?",
    },
    devices: "Mes appareils",
    devicesDetail:
      "Tartan reste ouvert sur chaque téléphone et chaque ordinateur où tu t'es connecté. Un appareil perdu ou prêté ? Déconnecte tous les autres : celui-ci reste connecté.",
    here: "Cet appareil",
    hereDetail: (email: string) => `Connecté avec ${email}.`,
  },
  espace: {
    section: "Identité de l'espace",
    saved: "Espace enregistré.",
    logoAlt: (name: string) => `Logo de ${name}`,
    strength: "Références de force",
    strengthDetail: "Rattache les tests de force saisis sous un ancien nom à une fiche de la bibliothèque.",
  },
  groupes: {
    section: "Groupes et liens d'invitation",
    detail: "Partage le lien ou le QR code d'un groupe : l'athlète qui l'ouvre rejoint ce groupe.",
    athletes: (count: number) => plural(count, "athlète", "athlètes"),
    name: "Nom",
    color: "Couleur",
    level: "Niveau",
    goal: "Objectif",
    deleteTitle: (name: string) => `Supprimer le groupe « ${name} » ?`,
    linkLabel: "Lien d'invitation du groupe",
    qrLabel: (name: string) => `QR code du groupe ${name}`,
    qrDetail: "Scanne ce code avec ton téléphone pour rejoindre le groupe.",
  },
  membres: {
    invite: "Inviter quelqu'un",
    sent: "Invitations envoyées",
    channel: "Moyen d'invitation",
    role: "Rôle",
    invited: "Invitation envoyée.",
    resent: "Invitation relancée.",
    empty: "Aucune invitation pour l'instant.",
    groupLink: "Lien de groupe",
    qr: "QR code",
    joined: (count: number) => plural(count, "inscrit", "inscrits"),
  },
  notifications: { icalLabel: "Lien de ton agenda", icalCopy: "Copier le lien de ton agenda" },
  apparence: { section: "Thème" },
  confidentialite: {
    consents: "Mes accords",
    data: "Mes données",
    spaces: "Mes espaces",
    account: "Mon compte",
    leaveDetail: (name: string) =>
      `Si tu quittes ${name}, tu ne verras plus ses séances et ta fiche dans cet espace sera supprimée.`,
    exportSpaceDetail: "Toutes les données de l'espace, dans un seul fichier.",
    ownSpaceDetail: "Tu entraînes aussi ? Ouvre ton propre espace, sans quitter celui-ci.",
    deleteDetail: "Efface ton compte et tes données, pour de bon.",
    deleteInvalid: "Écris SUPPRIMER pour confirmer.",
  },
  abonnement: {
    current: (plan: string) => `Offre ${plan}`,
  },
  aide: {
    section: "Aide et nouveautés",
    centerDetail: "Les réponses aux questions fréquentes, par thème.",
    releasesDetail: "Ce qui a changé dans Tartan, version après version.",
    syncDetail: "Les saisies faites sans réseau qui demandent ton choix.",
  },
} as const;
