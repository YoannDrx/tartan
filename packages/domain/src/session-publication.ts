import { publishSessionsInput, type CalendarSession } from "@tartan/contracts";
export const publicationCandidates = (sessions: readonly CalendarSession[]) =>
  sessions.filter((s) => !s.publishedAt && s.canPublish === true && typeof s.version === "number");
export function publicationSelection(sessions: readonly CalendarSession[], ids: readonly string[]) {
  const candidates = new Map(publicationCandidates(sessions).map((s) => [s.id, s]));
  return publishSessionsInput.parse({
    sessions: ids.map((id) => ({ id, expectedVersion: candidates.get(id)?.version })),
  });
}
