// La fiche d'un athlète, côté coach : profil, tests de force, performances, blessures, notes, invitation.
export const athletes = {
  level: "Niveau",
  notSpecified: "Non renseigné",
  strengthTest: {
    add: "Ajouter un test de force",
    load: "Charge (kg)",
    kind: "Type",
  },
  // Les unités d'une performance : un temps, une distance, une hauteur.
  units: { s: "s", m: "m", cm: "cm" },
  injury: {
    edit: "Modifier la blessure",
    open: "Ouvrir une fiche blessure",
    start: "Début",
    end: "Fin",
    status: "Statut",
    restrictions: "Restrictions",
    description: "Description",
  },
  newNote: "Nouvelle note",
  invite: {
    title: "Inviter cet athlète",
    sent: "Invitation envoyée. Valable 7 jours, à usage unique.",
    link: "Lien d'invitation",
  },
} as const;
