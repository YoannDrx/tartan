import { describe, expect, it } from "vitest";
import { barSheetInScope, hasHighJumpContext } from "./video-context";

describe("feuille de barres dans le contexte hauteur (audit G2)", () => {
  const ines = { id: "ines", disciplines: ["hurdles"], groupIds: ["sprint"] };
  const noe = { id: "noe", disciplines: ["high_jump"], groupIds: ["sauts"] };
  const sans = { id: "sans", disciplines: [], groupIds: ["sauts"] };
  it("n'est pas proposée à un coach dont personne ne saute en hauteur", () => {
    expect(barSheetInScope({ spaceDisciplines: [], athletes: [ines, sans] })).toBe(false);
    expect(barSheetInScope({ spaceDisciplines: ["high_jump"], athletes: [] })).toBe(false);
  });
  it("suit les filtres : l'athlète ou le groupe choisi doit sauter en hauteur", () => {
    expect(barSheetInScope({ spaceDisciplines: [], athletes: [ines, noe] })).toBe(true);
    expect(barSheetInScope({ spaceDisciplines: [], athletes: [ines, noe], athleteId: "ines" })).toBe(false);
    expect(barSheetInScope({ spaceDisciplines: [], athletes: [ines, noe], groupId: "sauts" })).toBe(true);
    expect(barSheetInScope({ spaceDisciplines: [], athletes: [ines, noe], groupId: "sprint" })).toBe(false);
  });
  it("un athlète sans épreuve renseignée suit celles de l'espace", () => {
    expect(barSheetInScope({ spaceDisciplines: ["high_jump"], athletes: [sans] })).toBe(true);
    expect(barSheetInScope({ spaceDisciplines: ["high_jump"], athletes: [ines] })).toBe(false);
  });
});

describe("contexte vidéo", () => {
  it("ne transforme pas une vidéo générique ni ses repères temporels en saut", () => {
    expect(hasHighJumpContext({})).toBe(false);
    expect(
      hasHighJumpContext({ barHeightCm: null, attemptNo: null, result: null, annotations: [{ phase: null }] }),
    ).toBe(false);
  });
  it("préserve chaque forme de métadonnée historique de saut", () => {
    for (const video of [
      { barHeightCm: 180 },
      { attemptNo: 2 },
      { result: "X" },
      { annotations: [{ phase: null }, { phase: "takeoff" }] },
    ])
      expect(hasHighJumpContext(video)).toBe(true);
  });
});
