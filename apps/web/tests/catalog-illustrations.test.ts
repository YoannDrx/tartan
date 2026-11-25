import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXERCISE_CATALOG, STADIUM_EDITION } from "@tartan/domain/exercise-catalog";
import { imagePath, pilots } from "@/server/catalog-illustrations";
import { stamp, withApprovedImage } from "@/server/catalog-editorial.service";
const catalog = [...EXERCISE_CATALOG, ...STADIUM_EDITION];
describe("Photographies du pilote", () => {
  it("associe chaque couple de fichiers WebP à une seule fiche et à la bonne édition", () => {
    expect(new Set(pilots.map((p) => p.key)).size).toBe(12);
    for (const pilot of pilots) {
      expect(catalog.filter((e) => e.catalogKey === pilot.key).map((e) => e.catalogVersion)).toEqual([
        pilot.guideVersion,
      ]);
      for (const thumb of [false, true]) {
        const bytes = readFileSync(new URL("../public" + imagePath(pilot, thumb), import.meta.url));
        expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
      }
    }
  });
  it("respecte les validations indépendantes, la version et les textes personnalisés", () => {
    const p = pilots[0],
      guide = catalog.find((e) => e.catalogKey === p.key)!.guide;
    const approvals = new Set([stamp(p.key, p.guideVersion, "text"), stamp(p.key, p.guideVersion, "motion")]);
    expect(withApprovedImage(guide, approvals)).toBe(guide);
    approvals.add(stamp(p.key, p.guideVersion, "image"));
    expect(withApprovedImage(guide, approvals)?.illustration.photo).toMatchObject({ path: imagePath(p), alt: p.alt });
    for (const original of [
      { ...guide, version: guide.version - 1 },
      { ...guide, author: "coach" as const },
    ])
      expect(withApprovedImage(original, approvals)).toBe(original);
  });
});
