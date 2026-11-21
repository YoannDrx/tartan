// L'analyse de l'entraînement sur le web (`/analyse`) : la phrase clé d'abord, puis ce qui reste à compléter.
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

export const analysis = {
  // La phrase clé, en tête de l'écran. Les chiffres sont mis en valeur par la mise en page.
  key: {
    completed: (n: number) => plural(n, "séance validée", "séances validées"),
    on: "sur",
    assigned: (n: number) => plural(n, "attribuée", "attribuées"),
    none: "Aucune séance attribuée sur cette période.",
    detail: "Validations complètes ou partielles, une par athlète et par séance.",
  },
  summary: "Volumes et couverture",
  // Les manques, regroupés en une seule invitation.
  gaps: {
    title: "À compléter",
    intro: "Ces informations manquent. L'analyse les laisse vides plutôt que de les estimer.",
    responses: (missing: number, total: number) =>
      `${missing} ${plural(missing, "séance attribuée", "séances attribuées")} sur ${total} sans réponse de l'athlète.`,
    sets: (missing: number, total: number) =>
      `${missing} ${plural(missing, "validation", "validations")} sur ${total} sans séries renseignées : le réalisé reste vide.`,
    feeling: (missing: number, total: number) =>
      `${missing} ${plural(missing, "validation", "validations")} sur ${total} sans effort ressenti ni durée.`,
    classification: (missing: number, total: number) =>
      `${missing} ${plural(missing, "exercice prescrit", "exercices prescrits")} sur ${total} sans mouvement principal.`,
    toTracking: "Voir le suivi",
    toExercises: "Compléter les exercices",
  },
  // Une valeur absente s'affiche par un tiret ; le lecteur d'écran lit `m.analysis.missing` à sa place.
  dash: "—",
} as const;
