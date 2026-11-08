import { expect, it } from "vitest";
import type { CalendarSession } from "@tartan/contracts";
import { publicationCandidates, publicationSelection } from "./session-publication";
const row: CalendarSession = {
  id: "00000000-0000-4000-8000-000000000001",
  version: 3,
  canPublish: true,
  title: "Force",
  type: "strength",
  date: "2030-06-01",
  startTime: null,
  location: null,
  publishedAt: null,
  audience: "Groupe",
  hasAutonomous: false,
};
it("sélectionne uniquement les brouillons autorisés dont la version est connue", () => {
  expect(
    publicationCandidates([
      row,
      { ...row, version: undefined },
      { ...row, canPublish: false },
      { ...row, publishedAt: "2030-06-01T12:00:00Z" },
    ]),
  ).toEqual([row]);
  expect(publicationSelection([row], [row.id])).toEqual({ sessions: [{ id: row.id, expectedVersion: 3 }] });
  expect(() => publicationSelection([], [row.id])).toThrow();
  expect(() => publicationSelection([row], [row.id, row.id])).toThrow();
});
