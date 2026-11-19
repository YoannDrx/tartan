import { expect, it } from "vitest";
import type { CalendarSession } from "@tartan/contracts";
import { publicationCandidates, publicationNotice, publicationSelection } from "./session-publication";
it("dit la vérité sur les destinataires d'une publication (audit G10)", () => {
  // Un groupe vide : personne ne reçoit rien, il faut inviter.
  expect(publicationNotice({ athletes: 0, notified: 0 })).toEqual({ kind: "empty" });
  // Des athlètes sans compte : la séance existe pour eux, mais aucune notification ne part.
  expect(publicationNotice({ athletes: 3, notified: 0 })).toEqual({ kind: "unreachable", athletes: 3 });
  expect(publicationNotice({ athletes: 3, notified: 2 })).toEqual({ kind: "notified", notified: 2, athletes: 3 });
  expect(publicationNotice({ athletes: 1, notified: 1 })).toEqual({ kind: "notified", notified: 1, athletes: 1 });
  // Un compte relié en double ne fait pas plus de destinataires que d'athlètes.
  expect(publicationNotice({ athletes: 2, notified: 3 })).toEqual({ kind: "notified", notified: 2, athletes: 2 });
});
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
