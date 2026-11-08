import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(import.meta.dirname, "../src/features/landing/images");
const manifest = JSON.parse(readFileSync(join(dir, "provenance.json"), "utf8")) as {
  dataset: string;
  captures: { file: string; source: "ios" | "web"; screen: string }[];
};

describe("écrans présentés sur le site", () => {
  it("proviennent tous d'une vraie capture documentée", () => {
    const images = readdirSync(dir).filter((file) => /\.(png|jpe?g|webp|avif)$/.test(file));
    expect(images.length).toBeGreaterThan(0);
    expect(images.sort()).toEqual(manifest.captures.map((capture) => capture.file).sort());
    expect(manifest.dataset).toContain("demo-preparation");
  });

  it("ne recompose aucune maquette dans la page", () => {
    const page = readFileSync(join(import.meta.dirname, "../app/page.tsx"), "utf8");
    expect(page).not.toMatch(/Demo\b|Scrubber/);
    for (const capture of manifest.captures) expect(page).toContain(capture.file);
  });
});
