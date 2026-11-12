import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : /\.tsx$/.test(name) ? [path] : [];
  });

// DESIGN.md : aucun texte sous 12 px. Les classes à taille libre sont le seul moyen d'en écrire un.
describe("taille des textes", () => {
  it("ne descend jamais sous 12 px dans un composant", () => {
    const small = [...sources(join(root, "app")), ...sources(join(root, "src"))].flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/\btext-\[(\d+(?:\.\d+)?)px\]/g)]
        .filter((match) => Number(match[1]) < 12)
        .map((match) => `${relative(root, file)} : ${match[0]}`),
    );
    expect(small).toEqual([]);
  });

  it("garde 12 px au moins dans la feuille de styles", () => {
    const css = readFileSync(join(root, "app/globals.css"), "utf8");
    const sizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]));
    expect(sizes.length).toBeGreaterThan(10);
    // Zéro sert à masquer un libellé que le lecteur d'écran garde (la frise du film sur téléphone).
    expect(sizes.filter((size) => size > 0 && size < 12)).toEqual([]);
  });
});
