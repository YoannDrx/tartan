import { publishSessionsInput, type CalendarSession } from "@tartan/contracts";
export const publicationCandidates = (sessions: readonly CalendarSession[]) =>
  sessions.filter((s) => !s.publishedAt && s.canPublish === true && typeof s.version === "number");

/**
 * Ce que dit la publication au coach : la vérité sur qui la reçoit. `athletes` compte les destinataires de la séance,
 * `notified` ceux qui ont un compte et reçoivent donc la notification.
 */
export type PublicationNotice =
  | { kind: "empty" }
  | { kind: "unreachable"; athletes: number }
  | { kind: "notified"; notified: number; athletes: number };
export function publicationNotice({ athletes, notified }: { athletes: number; notified: number }): PublicationNotice {
  if (athletes <= 0) return { kind: "empty" };
  if (notified <= 0) return { kind: "unreachable", athletes };
  return { kind: "notified", notified: Math.min(notified, athletes), athletes };
}
export function publicationSelection(sessions: readonly CalendarSession[], ids: readonly string[]) {
  const candidates = new Map(publicationCandidates(sessions).map((s) => [s.id, s]));
  return publishSessionsInput.parse({
    sessions: ids.map((id) => ({ id, expectedVersion: candidates.get(id)?.version })),
  });
}
