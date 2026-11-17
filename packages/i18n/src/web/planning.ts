// Le planning du coach (`/calendrier`) : cartes de séance, glisser-déposer, déplacement au clavier, phases.
// Les dates arrivent déjà écrites en toutes lettres (« jeudi 19 novembre »).
export const planning = {
  // Carte de séance.
  club: "Club",
  autonomous: "Autonomie",
  move: (title: string) => `Déplacer ${title}`,
  duplicate: (title: string) => `Dupliquer ${title}`,
  actions: (title: string) => `Déplacer ou dupliquer ${title}`,
  moveItem: "Déplacer",
  duplicateItem: "Dupliquer",
  readOnly: "Lecture seule",
  readOnlyHint: (title: string) => `${title} : tu ne peux ni la déplacer ni la dupliquer`,
  onDay: (action: string, date: string) => `${action} le ${date}`,

  // Choix d'une date, sans glisser.
  moveTitle: "Déplacer la séance",
  moveSubmit: "Déplacer",

  // Pendant le glisser.
  grabbed: (title: string) => `${title} saisie. Glisse-la vers un autre jour. Échap pour annuler.`,
  stays: "Reste à sa place",
  nowhere: "Dépose-la sur un jour",
  forbidden: "Tu ne peux pas déplacer cette séance",
  forbiddenDay: "Déplacement impossible",

  // Après le dépôt.
  moved: (title: string, date: string) => `${title} déplacée au ${date}.`,
  cancelled: (title: string) => `Déplacement de ${title} annulé.`,
  moveFailed: (title: string, date: string) =>
    `${title} n'a pas pu être déplacée : elle reste au ${date}. Vérifie ta connexion, puis réessaie.`,

  // Période affichée.
  previousPeriod: "Période précédente",
  nextPeriod: "Période suivante",

  // Phases de préparation, repliées au-dessus du planning.
  phasesNone: "aucune sur la période",
  phasesMore: (count: number) => `et ${count} autre${count > 1 ? "s" : ""}`,
  phasesManage: "Gérer",
  phasesManageLabel: "Gérer les phases de préparation",
  phasesSeeAll: "Tout voir",
  phasesSeeAllLabel: "Voir toutes les phases de préparation",
} as const;
