import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { m } from "@tartan/i18n";
import { describe, expect, it } from "vitest";

const dir = join(import.meta.dirname, "../src/features/landing/images");
const manifest = JSON.parse(readFileSync(join(dir, "provenance.json"), "utf8")) as {
  dataset: string;
  captures: { file: string; source: string; screen: string }[];
};
const page = readFileSync(join(import.meta.dirname, "../app/page.tsx"), "utf8");

// DESIGN.md : un écran présenté sur le site est une vraie capture du produit, sur des données fictives.
describe("captures de la page d'accueil", () => {
  it("proviennent toutes d'une capture documentée, sans image orpheline", () => {
    const images = readdirSync(dir).filter((file) => /\.(png|jpe?g|webp|avif)$/.test(file));
    expect(images.sort()).toEqual(manifest.captures.map((capture) => capture.file).sort());
    expect(manifest.dataset).toContain("demo-preparation");
  });

  it("chaque capture sert la page, un onglet par écran, avec son texte de remplacement", () => {
    for (const capture of manifest.captures) expect(page).toContain(`landing/images/${capture.file}`);
    const features = [...Object.values(m.landing.coach.features), ...Object.values(m.landing.athlete.features)];
    expect(features).toHaveLength(manifest.captures.length);
    for (const feature of features) expect(feature.alt.length, feature.tab).toBeGreaterThan(40);
  });
});
