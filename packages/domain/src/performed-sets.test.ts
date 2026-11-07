import { describe, expect, it } from "vitest";
import type { AthleteSessionDetail, ResolvedItem } from "@tartan/contracts";
import {
  confirmedSets,
  draftFromSession,
  proposedSet,
  performedDraftContent,
  resolvedDraftReceipt,
  isResolvedDraft,
} from "./performed-sets";

const item: ResolvedItem = {
  ref: "item",
  name: "Squat",
  category: "strength",
  cues: [],
  media: null,
  prescription: { sets: 3, reps: 4 },
  resolvedLoadKg: 40,
  summary: "3 × 4",
  strengthLoadKind: "external_total",
};
const session = {
  blocks: [{ items: [item] }],
  sessionVersion: 2,
  variant: "club",
  log: null,
} as unknown as AthleteSessionDetail;

describe("séries proposées et réalisées", () => {
  it("ne compte pas les séries proposées et ne transforme pas un manque en zéro", () => {
    const draft = draftFromSession(session);
    expect(confirmedSets(draft)).toEqual({ sets: [], issues: [] });
    draft.rows[0]!.done = true;
    expect(confirmedSets(draft).sets[0]).toMatchObject({ reps: 4, loadKg: 40, timeS: null, distanceM: null });
    expect(confirmedSets(draft).sets).toHaveLength(1);
  });
  it("exige une convention explicite pour une ancienne fiche non classée", () => {
    const row = { ...proposedSet({ ...item, strengthLoadKind: null }, 0), done: true };
    expect(confirmedSets({ ...draftFromSession(session), rows: [row] }).issues).toContainEqual(
      expect.objectContaining({ code: "convention" }),
    );
  });
  it("accepte les décimales françaises sans accepter les nombres tronqués", () => {
    const row = { ...proposedSet(item, 0), done: true, loadKg: "42,5" };
    const draft = { ...draftFromSession(session), rows: [row] };
    expect(confirmedSets(draft).sets[0]?.loadKg).toBe(42.5);
    for (const value of ["42kg", "-1", "1e2", "2.345", "Infinity"]) {
      row.loadKg = value;
      expect(confirmedSets(draft).issues.length).toBeGreaterThan(0);
    }
  });
  it("préserve les séries existantes, l'échauffement et les répétitions par côté", () => {
    const draft = draftFromSession(session);
    draft.rows[0] = { ...draft.rows[0]!, done: true, setKind: "warmup", repetitionScope: "per_side", sideCount: 2 };
    const sets = confirmedSets(draft).sets;
    const reread = draftFromSession({
      ...session,
      log: { status: "partial", version: 3, rpe: null, durationMin: null, comment: null, detailedSets: sets },
    });
    expect(reread.logVersion).toBe(3);
    expect(reread.rows[0]).toMatchObject({ done: true, setKind: "warmup", repetitionScope: "per_side", sideCount: 2 });
    expect(reread.rows[1]?.done).toBe(false);
  });
  it("ne convertit ni poids du corps ni assistance en charge externe", () => {
    const bodyweight = {
      ...proposedSet({ ...item, strengthLoadKind: "bodyweight", resolvedLoadKg: null }, 0),
      done: true,
    };
    const draft = { ...draftFromSession(session), rows: [bodyweight] };
    expect(confirmedSets(draft).sets[0]).toMatchObject({ loadKind: "bodyweight", loadKg: null });
    bodyweight.loadKg = "75";
    expect(confirmedSets(draft).issues).toContainEqual(expect.objectContaining({ field: "loadKg" }));
    const assistance = proposedSet({ ...item, strengthLoadKind: "assistance" }, 0);
    expect(assistance.loadKind).toBe("assisted");
  });
});

it("ne clôt le brouillon résolu qu'après accusé serveur et sans perdre une modification ultérieure", () => {
  const draft = draftFromSession(session);
  draft.rows[0]!.done = true;
  draft.submittedClientId = "old-client";
  draft.submittedContent = performedDraftContent(draft);
  const receipt = resolvedDraftReceipt(draft, ["old-client"], "new-client");
  expect(receipt).not.toBeNull();
  expect(isResolvedDraft(draft, receipt, "old-client")).toBe(false);
  expect(isResolvedDraft(draft, receipt, "new-client")).toBe(true);
  const second = resolvedDraftReceipt(draft, ["new-client"], "newer-client", receipt);
  expect(isResolvedDraft(draft, second, "newer-client")).toBe(true);
  const discarded = resolvedDraftReceipt(draft, ["new-client"], null, receipt);
  expect(isResolvedDraft(draft, discarded)).toBe(true);
  draft.rows[1]!.loadKg = "47.5"; // Une série encore non cochée reste un brouillon personnel.
  expect(resolvedDraftReceipt(draft, ["old-client"], "new-client")).toBeNull();
  expect(isResolvedDraft(draft, receipt, "new-client")).toBe(false);
  expect(isResolvedDraft(draft, discarded)).toBe(false);
});
