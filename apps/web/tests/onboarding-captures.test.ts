import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(import.meta.dirname, "../src/features/onboarding/captures");
const manifest = JSON.parse(readFileSync(join(dir, "provenance.json"), "utf8")) as {
  dataset: string;
  captures: { file: string; source: "ios" | "web"; screen: string }[];
};

// DESIGN.md : un écran présenté est une vraie capture du produit, sur des données fictives ; aucune maquette.
describe("captures du tour de piste", () => {
  it("proviennent toutes d'une vraie capture documentée", () => {
    const images = readdirSync(dir).filter((file) => /\.(png|jpe?g|webp|avif)$/.test(file));
    expect(images.sort()).toEqual(manifest.captures.map((capture) => capture.file).sort());
    expect(manifest.dataset).toContain("demo-preparation");
  });

  it("chaque capture sert au tour, qui n'en recompose aucune", () => {
    const tour = readFileSync(join(import.meta.dirname, "../src/features/onboarding/tour-features.ts"), "utf8");
    for (const capture of manifest.captures) expect(tour).toContain(`./captures/${capture.file}`);
    // Les autres images du tour sont celles du site, elles aussi documentées.
    const landing = JSON.parse(
      readFileSync(join(import.meta.dirname, "../src/features/landing/images/provenance.json"), "utf8"),
    ) as { captures: { file: string }[] };
    for (const [, file] of tour.matchAll(/landing\/images\/([\w-]+\.png)/g))
      expect(landing.captures.map((capture) => capture.file)).toContain(file);
  });
});
