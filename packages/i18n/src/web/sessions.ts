// Les séances du coach sur le web : ce que dit la publication, au plus près de la vérité (audit G10).
const athletes = (n: number) => `${n} athlète${n > 1 ? "s" : ""}`;

// Même forme que `publicationNotice` de `@tartan/domain`.
type Notice =
  | { kind: "empty" }
  | { kind: "unreachable"; athletes: number }
  | { kind: "notified"; notified: number; athletes: number };

export const sessions = {
  publishedMessage: (notice: Notice): string =>
    notice.kind === "empty"
      ? sessions.published.empty
      : notice.kind === "unreachable"
        ? sessions.published.unreachable(notice.athletes)
        : sessions.published.notified(notice.notified, notice.athletes),
  published: {
    empty: "Séance publiée. Personne ne la reçoit encore : invite tes athlètes avec le lien du groupe.",
    unreachable: (count: number) =>
      `Séance publiée pour ${athletes(count)}. Aucun n'a encore de compte, donc aucune notification n'est partie : invite-les avec le lien du groupe.`,
    notified: (notified: number, total: number) =>
      notified === total
        ? `Séance publiée. ${athletes(notified)} ${notified > 1 ? "reçoivent" : "reçoit"} la notification.`
        : `Séance publiée pour ${athletes(total)}. ${notified} ${notified > 1 ? "reçoivent" : "reçoit"} la notification ; les autres n'ont pas encore de compte.`,
  },
  // Les outils du calendrier : dupliquer une semaine, ajouter une compétition.
  calendarTools: {
    toWeek: "Vers la semaine du",
    toWeekHint: "Choisis le lundi de la semaine.",
    forGroup: "Pour le groupe",
    sameRecipients: "Mêmes destinataires",
    competitionName: "Nom",
    engaged: "Athlètes engagés",
  },
  // Les séries réalisées : un exercice replié montre où il en est.
  performedSets: {
    progress: (done: number, total: number) =>
      `${done} série${done > 1 ? "s" : ""} cochée${done > 1 ? "s" : ""} sur ${total}`,
  },
  // La validation d'une séance par l'athlète.
  validation: {
    effort: (n: number) => `Effort ${n} sur 10`,
    painScale: (label: string) => `${label} (1 à 10)`,
  },
} as const;
