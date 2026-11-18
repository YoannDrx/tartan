// Pages légales de la web app.
export const legal = {
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
