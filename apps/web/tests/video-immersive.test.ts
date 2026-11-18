import { describe, expect, it } from "vitest";
import {
  growSheet,
  moveCursor,
  samePoint,
  sheetForRemark,
  shortcutFor,
  shrinkSheet,
  snapSheet,
} from "@/features/videos/immersive-layout";

const pressed = (key: string, over: Partial<Parameters<typeof shortcutFor>[0]> = {}) =>
  shortcutFor({ key, repeat: false, modified: false, typing: false, control: false, dialog: false, ...over });

describe("raccourcis de l'analyse vidéo", () => {
  it("espace, flèches, F et M déclenchent chacun leur action", () => {
    expect(pressed(" ")).toBe("toggle");
    expect(pressed("ArrowLeft")).toBe("previous");
    expect(pressed("ArrowRight")).toBe("next");
    expect(pressed("f")).toBe("fullscreen");
    expect(pressed("F")).toBe("fullscreen");
    expect(pressed("m")).toBe("remark");
    expect(pressed("Escape")).toBe("exit");
    expect(pressed("a")).toBeNull();
  });

  it("se taisent pendant la saisie dans un champ, sauf Échap", () => {
    for (const key of [" ", "ArrowLeft", "ArrowRight", "f", "m"]) expect(pressed(key, { typing: true })).toBeNull();
    expect(pressed("Escape", { typing: true })).toBe("exit");
  });

  it("se taisent dans un dialogue et avec une touche de commande", () => {
    for (const key of [" ", "ArrowLeft", "f", "m", "Escape"]) {
      expect(pressed(key, { dialog: true })).toBeNull();
      expect(pressed(key, { modified: true })).toBeNull();
    }
  });

  it("laissent la barre d'espace au bouton qui a le focus", () => {
    expect(pressed(" ", { control: true })).toBeNull();
    expect(pressed("ArrowRight", { control: true })).toBe("next");
    expect(pressed("f", { control: true })).toBe("fullscreen");
  });

  it("ne répètent que le pas image par image quand la touche reste enfoncée", () => {
    expect(pressed("ArrowRight", { repeat: true })).toBe("next");
    for (const key of [" ", "f", "m", "Escape"]) expect(pressed(key, { repeat: true })).toBeNull();
  });
});

describe("feuille du plein écran sur téléphone", () => {
  it("passe d'une hauteur à la suivante sans dépasser les bornes", () => {
    expect(growSheet("rail")).toBe("half");
    expect(growSheet("half")).toBe("full");
    expect(growSheet("full")).toBe("full");
    expect(shrinkSheet("full")).toBe("half");
    expect(shrinkSheet("half")).toBe("rail");
    expect(shrinkSheet("rail")).toBe("rail");
  });

  it("se pose sur la hauteur la plus proche quand on la lâche", () => {
    expect(snapSheet(0.09)).toBe("rail");
    expect(snapSheet(0.3)).toBe("half");
    expect(snapSheet(0.7)).toBe("half");
    expect(snapSheet(0.8)).toBe("full");
  });

  it("s'arrête à moitié pour une remarque : l'image commentée reste visible", () => {
    expect(sheetForRemark("rail")).toBe("half");
    expect(sheetForRemark("half")).toBe("half");
    expect(sheetForRemark("full")).toBe("half");
  });
});

describe("repère du tracé au clavier", () => {
  it("avance d'un centième par flèche, d'un dixième avec Maj", () => {
    expect(moveCursor({ x: 0.5, y: 0.5 }, "ArrowRight", false)).toEqual({ x: 0.51, y: 0.5 });
    expect(moveCursor({ x: 0.5, y: 0.5 }, "ArrowUp", false)).toEqual({ x: 0.5, y: 0.49 });
    expect(moveCursor({ x: 0.5, y: 0.5 }, "ArrowLeft", true)).toEqual({ x: 0.4, y: 0.5 });
    expect(moveCursor({ x: 0.5, y: 0.5 }, "ArrowDown", true)).toEqual({ x: 0.5, y: 0.6 });
  });

  it("reste dans l'image", () => {
    expect(moveCursor({ x: 0.995, y: 0 }, "ArrowRight", false)).toEqual({ x: 1, y: 0 });
    expect(moveCursor({ x: 0.05, y: 0 }, "ArrowLeft", true)).toEqual({ x: 0, y: 0 });
    expect(moveCursor({ x: 0, y: 0 }, "ArrowUp", false)).toEqual({ x: 0, y: 0 });
  });

  it("ignore les autres touches", () => {
    expect(moveCursor({ x: 0.5, y: 0.5 }, "Enter", false)).toBeNull();
  });

  it("refuse deux points au même endroit", () => {
    expect(samePoint({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBe(true);
    expect(samePoint({ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.5 })).toBe(false);
    expect(samePoint(undefined, { x: 0.5, y: 0.5 })).toBe(false);
  });
});
