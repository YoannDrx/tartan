import { describe, expect, it } from "vitest";
import {
  dragSheet,
  growSheet,
  immersiveLayout,
  PANEL_RAIL,
  panelWidth,
  sheetForRemark,
  shrinkSheet,
  snapSheet,
} from "./video-immersive";

describe("feuille de l'éditeur en plein écran", () => {
  it("monte et descend d'une hauteur à la fois, sans dépasser les bornes", () => {
    expect(growSheet("rail")).toBe("half");
    expect(growSheet("half")).toBe("full");
    expect(growSheet("full")).toBe("full");
    expect(shrinkSheet("full")).toBe("half");
    expect(shrinkSheet("rail")).toBe("rail");
  });

  it("se pose sur la hauteur la plus proche quand on lâche la poignée", () => {
    expect(snapSheet(0.1)).toBe("rail");
    expect(snapSheet(0.45)).toBe("half");
    expect(snapSheet(0.9)).toBe("full");
    // 300 points vers le haut sur 400 disponibles, depuis la moitié : entière.
    expect(dragSheet("half", -300, 400)).toBe("full");
    expect(dragSheet("half", 150, 400)).toBe("rail");
    expect(dragSheet("half", 20, 400)).toBe("half");
    expect(dragSheet("half", -300, 0)).toBe("half");
  });

  it("revient à moitié pour écrire une remarque : l'image commentée reste visible", () => {
    expect(sheetForRemark("rail")).toBe("half");
    expect(sheetForRemark("full")).toBe("half");
    expect(sheetForRemark("half")).toBe("half");
  });
});

describe("agencement du plein écran", () => {
  it("met l'éditeur à droite en paysage et sur écran large, en feuille en portrait", () => {
    expect(immersiveLayout({ width: 390, height: 844 })).toBe("sheet");
    expect(immersiveLayout({ width: 844, height: 390 })).toBe("side");
    expect(immersiveLayout({ width: 1024, height: 1366 })).toBe("side");
  });

  it("garde un panneau lisible, et un rail fin une fois replié", () => {
    expect(panelWidth(844, false)).toBe(300);
    expect(panelWidth(1366, false)).toBe(420);
    expect(panelWidth(1180, false)).toBe(393);
    expect(panelWidth(844, true)).toBe(PANEL_RAIL);
  });
});
