// Pages légales de la web app.
export const legal = {
  notice: {
    title: "Mentions légales",
    updated: "4 novembre 2026",
    publisher: "Éditeur",
    publisherIdentity:
      "Tartan est édité sous le nom commercial Yodev par Yoann Andrieux, entrepreneur individuel. SIREN 803 272 590, SIRET 803 272 590 00024, code NAF/APE 62.01Z. TVA non applicable, article 293 B du Code général des impôts.",
    publisherContact:
      "Adresse : 7 allée des Jonquilles, 95130 Franconville, France. Contact : hello@tartan.coach. Directeur de la publication : Yoann Andrieux.",
    hosting: "Hébergement",
    hostingApp:
      "Site et application : Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis, exécution en Union européenne (Francfort).",
    hostingDatabase: "Base de données : Neon (neon.com), région Union européenne (Francfort).",
    hostingVideos:
      "Stockage et diffusion des vidéos : Mux, Inc., 88 Stevenson Street, San Francisco, CA 94105, États-Unis.",
    hostingPlanner: "Planificateur IA : OpenAI, États-Unis, uniquement après l'accord de la personne qui l'utilise.",
    property: "Propriété intellectuelle",
    propertyDetail:
      "La marque, le logo et l'application Tartan appartiennent à leur éditeur. Les contenus publiés par les coachs et les athlètes restent les leurs.",
  },
  privacy: {
    title: "Politique de confidentialité",
    updated: "25 novembre 2026",
    controller:
      "Responsable du traitement : Yodev, Yoann Andrieux, entrepreneur individuel, SIREN 803 272 590, 7 allée des Jonquilles, 95130 Franconville. Contact : hello@tartan.coach.",
    adultsOnly:
      "Tartan est réservé aux personnes majeures, en France. La date de naissance déclarée sert à appliquer cette règle : ce n'est pas une vérification d'identité.",
    processing: "Ce que Tartan traite, et pourquoi",
    processingItems: [
      "Identité et compte (nom, e-mail, date de naissance, photo) : pour fournir le service. Base : le contrat.",
      "Entraînement (séances, validations, charges, records) : pour le suivi entre le coach et l'athlète. Base : le contrat.",
      "Les consignes vocales du coach accompagnent les exercices dans les séances attribuées. Les enregistrements de brouillon sans séance ni modèle sont supprimés après 30 jours.",
      "Le débrief vocal de fin de séance est facultatif. Seuls l’athlète et les coachs habilités à son suivi peuvent l’écouter. Les vocaux de séance sont conservés dans la base de Tartan et ne font pas l’objet d’une transcription.",
      "Santé (blessures, douleurs, effort ressenti et débriefs vocaux) : uniquement avec ton consentement explicite et séparé, révocable à tout moment dans les réglages, pour chaque espace. Sans lui, l'app fonctionne et ces champs restent masqués. Base : ton consentement explicite.",
      "Vidéos de saut : uniquement avec ton consentement. Visibles par tes coachs et par toi, jamais publiques, jamais partagées au groupe par défaut. Base : ton consentement.",
      "Données techniques (jetons de notification, journaux d'erreurs sans donnée de santé) : pour faire fonctionner et sécuriser le service. Base : notre intérêt légitime.",
      "Mesure d'audience (pages vues sans jeton ni identifiant, provenance, pays, appareil, navigateur) : statistiques agrégées pour améliorer le service, sans cookie tiers ni donnée de santé. Base : notre intérêt légitime.",
    ],
    // L'athlète autonome et le partage de son historique (décision du 23 novembre 2026), à faire relire.
    personalSpace: "Si tu t'entraînes seul",
    personalSpaceDetail:
      "Ton espace personnel n'a que toi comme membre : personne d'autre, ni coach ni autre athlète, ne voit tes séances, tes validations, tes tests, tes records ni tes vidéos. Tu es seul responsable de ce que tu y notes. Il est gratuit et n'est jamais facturé. Tes données y restent tant que ton compte est actif ; elles sont supprimées avec ton compte, selon les durées ci-dessous.",
    sharing: "Si tu partages ton historique avec un coach",
    sharingDetail:
      "En rejoignant le groupe d'un coach, tu peux lui partager, case par case, tes records, tes références de force et l'historique de tes séances personnelles. Il les lit en lecture seule, sur ta fiche, tant que tu les partages : rien n'est copié dans son espace. Tu retires ce partage à tout moment dans Réglages, Confidentialité, et il cesse aussitôt. Tes données de santé (effort ressenti, douleurs, blessures) de ton espace personnel n'en font jamais partie. Chaque lecture par un coach est tracée, comme les autres accès aux données sensibles.",
    coachRecord: "Si ton coach a créé ta fiche",
    coachRecordDetail:
      "Un coach peut préparer ta fiche (nom, date de naissance, groupe) avant que tu aies un compte, pour te suivre et t'inviter. C'est lui qui t'en informe. Tu peux demander sa correction ou sa suppression à ton coach, ou en nous écrivant.",
    withdrawal: "Si tu retires ton consentement",
    withdrawalDetail:
      "Santé : ton effort ressenti, tes douleurs, tes blessures et tes débriefs vocaux de cet espace sont effacés aussitôt, après confirmation. Vidéos : elles sont masquées aussitôt, puis effacées au bout de 30 jours, sauf si tu redonnes ton accord entre-temps. Le retrait ne remet pas en cause ce qui a été fait avant lui, et les exports déjà réalisés restent chez leurs détenteurs.",
    location: "Où vont tes données",
    locationDetail:
      "La base de données et l'exécution du service sont à Francfort. Les vidéos sont stockées et diffusées par Mux, aux États-Unis. Sous-traitants : Vercel, Neon, Mux, Expo, Resend, Sentry (suivi des erreurs, sans contenu d'entraînement ni de santé), Stripe, OpenAI (planificateur IA) et GitHub (copie de sauvegarde chiffrée). Certains sont établis aux États-Unis : les transferts sont encadrés par leurs clauses contractuelles types.",
    retention: "Combien de temps",
    retentionDetail:
      "Tes données restent tant que ton compte est actif. Un athlète retiré d'un espace, ou qui le quitte, voit sa fiche et ses données d'entraînement de cet espace supprimées. Les vidéos suivent la durée de conservation de l'offre de l'espace.",
    // Les durées, dans l'ordre de la page ; celle du planificateur vient de son propre domaine.
    retentionAccounts: [
      "Compte inactif : supprimé après 24 mois sans connexion, avec un préavis de 30 jours. Si son propriétaire est inactif, un espace encore utilisé est confié à un autre coach actif. Sans repreneur, le support organise la succession avant la suppression du compte. L’activité de l’espace provient des séances, validations, appels et contributions, pas des tâches automatiques.",
      "Fiche préparée par un coach, sans compte : supprimée après 12 mois sans activité.",
      "Coordonnées d'une invitation : effacées 30 jours après son expiration.",
      "File technique des e-mails transactionnels : messages envoyés ou en échec purgés après 30 jours, destinataires et contenu compris.",
      "Notifications : 90 jours.",
    ],
    retentionRecords: [
      "Journaux d'accès aux données sensibles et d'audit : 1 an.",
      "Signalement traité : 1 an.",
      "Événements d'abonnement : 13 mois. Factures : 10 ans, comme la loi l'impose.",
      "Copies de sauvegarde : 30 jours. Une donnée effacée peut y rester jusqu'à leur expiration.",
    ],
    rights: "Tes droits",
    rightsDetail:
      "Accès, rectification, export, opposition, retrait du consentement, suppression. L'export de tes données se fait depuis les réglages. La suppression du compte se fait depuis les réglages de l'app : elle efface ton compte et tes contenus, sauf obligation légale de conservation. Tu peux aussi saisir la CNIL.",
  },
  // « Supprimer mon compte », exigée par Google Play.
  accountDeletion: {
    title: "Supprimer mon compte",
    description: "Comment supprimer ton compte Tartan et les données associées.",
    updated: "17 novembre 2026",
    fromApp: "Depuis Tartan",
    fromAppBefore: "Dans l'application ou sur ",
    fromAppLink: "app.tartan.coach",
    fromAppAfter:
      " : Réglages, Confidentialité, puis « Supprimer mon compte ». Ton compte disparaît aussitôt. Les fichiers chez nos prestataires, comme les vidéos, sont retirés dans l'heure en temps normal.",
    withoutAccess: "Sans accès à ton compte",
    withoutAccessBefore: "Écris à ",
    withoutAccessAfter:
      " depuis l'adresse de ton compte, avec pour objet « Suppression de compte ». Nous la traitons sous 30 jours au plus.",
    deleted: "Ce qui est supprimé",
    deletedDetail:
      "Ton compte, ton profil, tes séances réalisées, tes tests, tes blessures, tes vidéos, tes commentaires et tes accords. Si tu es propriétaire d'un espace sans autre coach, l'espace et ses données sont supprimés, et son abonnement est résilié : plus aucun prélèvement. S'il a d'autres coachs, l'espace est repris par le plus ancien d'entre eux, qui en est prévenu ; l'abonnement s'arrête à la fin de la période payée.",
    kept: "Ce qui est conservé",
    keptDetail:
      "Les factures, 10 ans, comme la loi l'impose, chez nous et chez Stripe. Les journaux techniques, 1 an au plus, sans contenu d'entraînement. Les copies de sauvegarde, 30 jours au plus : tes données y restent jusqu'à leur expiration.",
  },
} as const;
