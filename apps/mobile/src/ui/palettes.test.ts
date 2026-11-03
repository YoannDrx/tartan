import { describe, expect, it } from "vitest";
import { palettes, type Palette, type SceneName } from "./palettes";

const channel = (value: number) => {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) => {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const ALL = Object.values(palettes);
const WORLDS: SceneName[] = ["piste", "couloir", "craie", "soleil", "nuit"];

describe("palettes", () => {
  it.each(ALL.map((p) => [p.name, p] as const))("%s : le texte tient 4,5:1", (_name, p: Palette) => {
    for (const fg of [p.text, p.textMuted, p.link, p.danger]) {
      expect(contrast(fg, p.bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(p.accentText, p.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.onRaised, p.raised)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(ALL.map((p) => [p.name, p] as const))("%s : l'accent se détache du fond", (_name, p: Palette) => {
    expect(contrast(p.accent, p.bg)).toBeGreaterThanOrEqual(3);
  });

  it("sur un monde plein, le texte atténué garde la couleur du texte", () => {
    for (const name of WORLDS) expect(palettes[name].textMuted).toBe(palettes[name].text);
  });

  it("l'accent est citron sur les fonds soutenus, encre sur les fonds clairs", () => {
    for (const name of ["piste", "couloir", "nuit", "card", "encre"] as const) {
      expect(palettes[name].accent).toBe("#C6F432");
      expect(palettes[name].accentText).toBe("#15161A");
    }
    for (const name of ["craie", "soleil", "hero"] as const) {
      expect(palettes[name].accent).toBe("#15161A");
      expect(palettes[name].accentText).toBe("#C6F432");
    }
  });

  it("sur la piste, les liens restent blancs", () => {
    expect(palettes.piste.link).toBe("#FFFFFF");
  });

  // Sur la piste, le couloir et la nuit, les statuts ne s'affichent que dans les cartes encre.
  it.each(["card", "encre", "nuitCard", "hero", "craie", "soleil"] as const)(
    "%s : les statuts se lisent sur le fond",
    (name) => {
      const p = palettes[name];
      for (const value of Object.values(p.status)) expect(contrast(value, p.bg)).toBeGreaterThanOrEqual(3);
      expect(contrast(p.onStatus, p.status.done)).toBeGreaterThanOrEqual(3);
      expect(contrast(p.onStatus, p.status.missed)).toBeGreaterThanOrEqual(3);
    },
  );

  it("les cheveux de la mascotte restent visibles sur le fond", () => {
    for (const p of ALL) expect(contrast(p.jumperHair, p.bg)).toBeGreaterThanOrEqual(3);
  });
});
