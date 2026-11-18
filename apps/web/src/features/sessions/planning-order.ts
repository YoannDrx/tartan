// L'ordre du planning, calculé comme le serveur le fait (`listCalendar` : la date, puis l'heure, les séances
// sans heure en dernier). La carte déposée prend donc tout de suite la place qu'elle gardera à la réponse.
type Slot = { id: string; date: string; startTime?: string | null };

// « ~ » se range après tous les chiffres : une séance sans heure ferme la journée.
const rank = (slot: Slot) => `${slot.date} ${slot.startTime ?? "~"}`;

/** Le planning une fois la séance posée à sa nouvelle date. À heure égale, l'ordre d'avant est gardé. */
export const moveInPlanning = <T extends Slot>(sessions: T[], id: string, date: string): T[] =>
  sessions
    .map((session) => (session.id === id ? { ...session, date } : session))
    .sort((a, b) => (rank(a) < rank(b) ? -1 : rank(a) > rank(b) ? 1 : 0));

/** Le rang que prendra la séance dans sa nouvelle journée : devant quelle carte montrer le repère. */
export const landingIndex = (sessions: Slot[], id: string, date: string): number =>
  moveInPlanning(sessions, id, date)
    .filter((session) => session.date === date)
    .findIndex((session) => session.id === id);
