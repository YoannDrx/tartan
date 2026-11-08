export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 7;

// Heures calmes par défaut 22 h – 7 h, sauf alerte douleur pour le coach (§ 13.2).
export const isQuietHours = (hour: number): boolean => hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;

export type NotificationType =
  | "session_published"
  | "session_batch_published"
  | "session_eve"
  | "session_autonomous"
  | "session_reminder"
  | "session_updated"
  | "video_shared"
  | "comment"
  | "pain_alert"
  | "missed_streak"
  | "announcement"
  | "member_joined"
  | "session_cancelled"
  | "scheduled_publication_blocked";

export const bypassesQuietHours = (type: NotificationType): boolean => type === "pain_alert";

const dayLabel = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" });
export const weekdayFr = (isoDate: string): string => dayLabel.format(new Date(`${isoDate}T12:00:00.000Z`));

// Le texte porte le nom du coach, jamais de donnée de santé (écran verrouillé, § 15.2).
export const renderNotification = (
  type: NotificationType,
  v: { coach?: string; athlete?: string; date?: string; height?: string; count?: number; group?: string },
): { title: string; body: string } => {
  const day = v.date ? weekdayFr(v.date) : "";
  const coach = v.coach ?? "Ton coach";
  switch (type) {
    case "session_published":
      return { title: "Tartan", body: `${coach} t'a envoyé une séance pour ${day}` };
    case "session_batch_published":
      return { title: "Tartan", body: `${coach} t'a envoyé ${v.count ?? 0} séances` };
    case "session_eve":
      return { title: "Tartan", body: "Seras-tu au club demain ?" };
    case "session_autonomous":
      return { title: "Tartan", body: "Ta séance de demain en autonomie est prête" };
    case "session_reminder":
      return { title: "Tartan", body: "Comment s'est passée ta séance ?" };
    case "session_updated":
      return { title: "Tartan", body: `Ta séance de ${day} a été modifiée` };
    case "video_shared":
      return {
        title: "Tartan",
        body: v.height ? `${coach} a commenté ton saut à ${v.height} m` : `${coach} a partagé un saut avec toi`,
      };
    case "comment":
      return { title: "Tartan", body: `${v.athlete ?? coach} a ajouté un commentaire` };
    case "pain_alert":
      return { title: "Tartan", body: `Nouvelle alerte de ${v.athlete ?? "ton groupe"}` };
    case "missed_streak":
      return { title: "Tartan", body: `${v.athlete ?? "Un athlète"} n'a pas validé ses 2 dernières séances` };
    case "announcement":
      return { title: v.group ?? "Tartan", body: `${coach} a publié une annonce` };
    case "scheduled_publication_blocked":
      return {
        title: "Tartan",
        body: `La séance programmée pour ${day} attend ta relecture : son auteur n'a plus accès`,
      };
    case "session_cancelled":
      return { title: "Tartan", body: `Ta séance de ${day} est annulée` };
    case "member_joined":
      return { title: "Tartan", body: `${v.athlete ?? "Un athlète"} a rejoint ton espace` };
  }
};

// Regroupement : plusieurs séances publiées d'un coup = une seule notification.
export const groupPublications = <T extends { userId: string; date: string }>(
  items: T[],
): { userId: string; dates: string[] }[] => {
  const byUser = new Map<string, string[]>();
  for (const it of items) byUser.set(it.userId, [...(byUser.get(it.userId) ?? []), it.date]);
  return [...byUser].map(([userId, dates]) => ({ userId, dates }));
};
