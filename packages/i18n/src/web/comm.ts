// Annonces et commentaires, côté web.
export const comm = {
  unpin: "Désépingler",
  deleteAnnouncement: "Supprimer cette annonce ?",
  // Le bilan de la semaine, envoyé au coach par e-mail.
  digest: {
    preview: (week: string) => `Ta semaine du ${week}`,
    title: (week: string) => `Semaine du ${week}`,
    summary: (organization: string, sessions: number, completionPct: number | null) =>
      `${organization} : ${sessions} séance${sessions > 1 ? "s" : ""} publiée${sessions > 1 ? "s" : ""}${
        completionPct === null ? "." : `, ${completionPct} % de réalisation.`
      }`,
    cta: "Voir le suivi",
  },
} as const;
