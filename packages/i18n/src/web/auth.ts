// L'entrée dans Tartan sur le web : le formulaire de connexion et de création de compte, l'écran « lien envoyé »,
// la proposition de mot de passe de l'accueil, et les e-mails qui accompagnent un mot de passe.
// Les textes que le mobile affiche aussi restent dans `../fr.ts` (`m.auth.*`).
export const auth = {
  emailInvalid: "Indique une adresse e-mail valide, par exemple toi@exemple.fr.",
  // Les deux chemins, de même rang, sous l'adresse.
  paths: "Moyen de connexion",
  signIn: {
    withPassword: "Continuer avec mon mot de passe",
    withLink: "Recevoir un lien de connexion",
    passwordLabel: "Mot de passe",
    submit: "Se connecter",
    forgot: "Mot de passe oublié ?",
  },
  create: {
    lead: (athletes: number) =>
      `Gratuit jusqu'à ${athletes} athlètes, sans carte bancaire. Choisis un mot de passe, ou reçois un lien dans ta boîte mail.`,
    // Inscriptions des coachs fermées, athlètes autonomes ouvertes : le compte se crée, l'aiguillage suit.
    leadSolo:
      "Gratuit pour t'entraîner seul. Choisis un mot de passe, ou reçois un lien dans ta boîte mail : tu diras ensuite comment tu utilises Tartan.",
    withPassword: "Créer avec un mot de passe",
    withLink: "Créer avec un lien par e-mail",
    passwordLabel: "Choisis ton mot de passe",
    submit: "Créer mon compte",
  },
  linkInstead: "Recevoir un lien à la place",
  passwordHint: (min: number) => `${min} caractères au minimum.`,
  passwordTooShort: (min: number) => `Choisis un mot de passe d'au moins ${min} caractères.`,
  passwordRequired: "Saisis ton mot de passe.",
  showPassword: "Afficher le mot de passe",
  hidePassword: "Masquer le mot de passe",
  // Le même message qu'un compte existe ou non : il dit quoi faire, pas ce qui manque.
  invalidCredentials:
    "Adresse ou mot de passe incorrect. Vérifie ta saisie, ou reçois un lien de connexion : il marche même sans mot de passe.",
  rateLimited: "Trop d'essais en peu de temps. Attends une minute, puis réessaie.",
  linkExpired: "Ce lien n'est plus valable : il a déjà servi ou il a expiré. Demandes-en un nouveau.",
  haveAccount: "J'ai déjà un compte Tartan",
  noAccountYet: "Je n'ai pas encore de compte",
  terms: {
    before: "En continuant, tu acceptes les",
    conditions: "conditions d'utilisation",
    between: "et la",
    privacy: "politique de confidentialité",
  },
  inviteLead: "Crée ton compte ou connecte-toi pour rejoindre. Tu reviendras ici juste après.",
  inviteTitle: "Invitation",
  // Invitation nominative : l'adresse visée se lit avant le formulaire, pour ne pas l'apprendre à l'envoi.
  inviteFor: "Cette invitation est destinée à",
  inviteSignedInAs: "Tu es connecté avec",
  inviteWrongAccount: "Pour la rejoindre, connecte-toi avec l'adresse de l'invitation.",
  switchAccount: "Changer de compte",
  // L'écran d'attente, après l'envoi d'un lien de connexion ou de confirmation.
  sent: {
    magicTitle: "Regarde ta boîte mail",
    // L'adresse s'affiche entre les deux phrases, sur sa ligne : c'est elle qu'on vérifie d'abord.
    magicLead: "Un lien de connexion vient de partir vers :",
    magicDetail: "Il marche une fois et reste valable 15 minutes.",
    verifyTitle: "Confirme ton adresse",
    verifyLead: "Un message vient de partir vers :",
    verifyDetail: "Ouvre le lien qu'il contient pour continuer : tu arriveras connecté. Il reste valable 1 heure.",
    // Connexion par mot de passe sur une adresse pas encore confirmée.
    verifyFirst: "Ton adresse n'est pas encore confirmée : le lien vient de repartir.",
    resend: "Renvoyer le lien",
    resendIn: (seconds: number) => `Renvoyer le lien dans ${seconds} s`,
    resent: "C'est reparti. Regarde ta boîte mail.",
    resendLimited: "Trop d'envois en peu de temps. Attends une minute, puis renvoie le lien.",
    changeEmail: "Changer d'adresse",
    helpTitle: "Rien reçu ?",
    help: [
      "Regarde dans les indésirables et dans l'onglet Promotions.",
      "Vérifie que l'adresse ci-dessus est la bonne. Sinon, change-la.",
      "Toujours rien après deux minutes : renvoie le lien, ou écris-nous à hello@tartan.coach.",
    ],
  },
  // La proposition facultative de l'accueil, pour qui est entré par un lien.
  prompt: {
    title: "Un mot de passe pour revenir plus vite",
    body: "Tu es entré avec un lien reçu par e-mail. Avec un mot de passe, tu te reconnectes tout de suite, sans passer par ta boîte mail. C'est facultatif : le lien marchera toujours.",
    open: "Définir un mot de passe",
    dismiss: "Non merci",
    dismissed: "C'est noté. Tu pourras en définir un dans Réglages, rubrique Connexion.",
    field: "Ton mot de passe",
    submit: "Définir mon mot de passe",
    cancel: "Annuler",
    done: "Mot de passe défini. Tu peux t'en servir à ta prochaine connexion.",
  },
  // Messages des services : ce que le serveur refuse, et quoi faire.
  errors: {
    passwordAlreadySet: "Ce compte a déjà un mot de passe. Pour le changer, saisis le mot de passe actuel.",
    noPassword: "Ce compte n'a pas encore de mot de passe. Définis-en un d'abord.",
    wrongCurrent: "Ce n'est pas ton mot de passe actuel. Réessaie, ou passe par « Mot de passe oublié ».",
    sameAsCurrent: "Choisis un mot de passe différent de l'actuel.",
    tooManyAttempts: "Trop d'essais en peu de temps. Attends dix minutes, puis réessaie.",
  },
  emails: {
    // Connexion, vérification, invitations : les e-mails qui portent un lien d'action.
    magicLink: {
      preview: "Ton lien de connexion à Tartan",
      title: "Connecte-toi à Tartan",
      body: "Ce lien fonctionne une fois et expire dans 15 minutes.",
      cta: "Me connecter",
      ignore: "Tu n'as rien demandé ? Ignore ce message, rien ne changera.",
    },
    verify: {
      preview: "Confirme ton adresse pour Tartan",
      title: "Confirme ton adresse",
      body: "Un clic suffit pour activer ton compte Tartan. Ce lien reste valable 1 heure.",
      cta: "Confirmer mon adresse",
      ignore: "Tu n'as rien demandé ? Ignore ce message, le compte restera inactif.",
    },
    notification: { cta: "Ouvrir Tartan" },
    reset: {
      preview: "Réinitialise ton mot de passe Tartan",
      title: "Nouveau mot de passe",
      body: "Ce lien te permet de choisir un nouveau mot de passe. Il reste valable 1 heure.",
      cta: "Choisir un mot de passe",
      ignore: "Tu n'as rien demandé ? Ignore ce message, ton mot de passe reste le même.",
    },
    personalLink: "Ce lien est personnel, sert une seule fois et reste valable 7 jours.",
    invitation: {
      title: (inviter: string, target: string) => `${inviter} t'invite à rejoindre ${target}`,
      body: "Tes séances arriveront directement dans Tartan.",
      cta: "Rejoindre le groupe",
    },
    staffInvitation: {
      title: (inviter: string, organization: string) => `${inviter} t'invite dans l'espace ${organization}`,
      role: {
        coach: "Tu pourras préparer les séances, suivre les retours des athlètes et analyser leurs sauts.",
        assistant: "Tu pourras gérer tes séances et voir les retours des athlètes de tes groupes.",
      },
      cta: "Rejoindre l'espace",
      unknown: (inviter: string) => `Tu ne connais pas ${inviter} ? Ignore ce message, rien ne sera créé.`,
    },
    parentalConsent: {
      preview: (athlete: string) => `Ton accord est demandé pour ${athlete}`,
      title: (athlete: string) => `${athlete} a besoin de ton accord`,
      body: (athlete: string, coach: string) =>
        `${athlete} rejoint le groupe d'entraînement de ${coach} sur Tartan. Comme il ou elle a moins de 15 ans, ton accord est nécessaire pour traiter ses informations de santé et conserver ses vidéos de saut.`,
      cta: "Lire et répondre",
      noAnswer: "Sans réponse de ta part, ces deux usages restent désactivés.",
    },
    passwordSet: {
      subject: "Un mot de passe a été défini sur ton compte Tartan",
      body: "Tu peux maintenant te connecter avec ton adresse et ce mot de passe. Le lien reçu par e-mail marche toujours.",
      notYou:
        "Ce n'est pas toi ? Choisis tout de suite un autre mot de passe, puis déconnecte tes autres appareils dans Réglages, rubrique Connexion. Écris-nous à hello@tartan.coach.",
      cta: "Choisir un autre mot de passe",
    },
    confirmSetup: {
      subject: "Confirme que c'est bien toi",
      body: "Tu as demandé à définir un mot de passe pour ton compte Tartan. Ouvre ce lien sur l'appareil où tu as fait la demande : tu pourras ensuite choisir ton mot de passe. Il marche une fois et expire dans 15 minutes.",
      cta: "Confirmer et choisir mon mot de passe",
      ignore: "Tu n'as rien demandé ? Ignore ce message : aucun mot de passe ne sera défini.",
    },
    accountExists: {
      subject: "Tu as déjà un compte Tartan",
      body: "Quelqu'un, sans doute toi, vient de vouloir créer un compte avec cette adresse. Tu en as déjà un : connecte-toi avec un lien reçu par e-mail, ou avec ton mot de passe.",
      detail:
        "Le mot de passe saisi à l'instant n'a pas été enregistré. Pour en définir un, ouvre Réglages, rubrique Connexion.",
      cta: "Me connecter",
      // L'inscription venait d'une invitation : le bouton connecte puis rouvre l'invitation.
      bodyInvitation:
        "Quelqu'un, sans doute toi, vient de vouloir créer un compte avec cette adresse pour répondre à une invitation. Tu en as déjà un : connecte-toi, l'invitation se rouvre aussitôt.",
      ctaInvitation: "Me connecter et rejoindre",
      ignore: "Ce n'était pas toi ? Ignore ce message, rien n'a changé.",
    },
  },
} as const;
