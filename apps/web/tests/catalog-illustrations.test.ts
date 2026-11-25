import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXERCISE_CATALOG, STADIUM_EDITION } from "@tartan/domain/exercise-catalog";
import { imagePath, catalogImages } from "@/server/catalog-illustrations";
import { prisma } from "@/lib/prisma";
import { getActorFrom } from "@/lib/session";
import { recordStepUp } from "@/server/admin-step-up.service";
import { makeUser } from "./helpers";
import { sessionCookie } from "./personas";
import { reviewEditorial, stamp, withApprovedImage } from "@/server/catalog-editorial.service";
const catalog = [...EXERCISE_CATALOG, ...STADIUM_EDITION];
describe("Illustrations du catalogue", () => {
  it("associe chaque couple de fichiers WebP à une seule fiche et à la bonne édition", () => {
    expect(new Set(catalogImages.map((p) => p.key)).size).toBe(18);
    for (const pilot of catalogImages) {
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
    const p = catalogImages[0],
      guide = catalog.find((e) => e.catalogKey === p.key)!.guide;
    const approvals = new Set([stamp(p.key, p.guideVersion, "text"), stamp(p.key, p.guideVersion, "motion")]);
    expect(withApprovedImage(guide, approvals)?.illustration).toMatchObject({ motion: "approved" });
    expect(withApprovedImage(guide, approvals)?.illustration.photo).toBeUndefined();
    approvals.add(stamp(p.key, p.guideVersion, "image"));
    expect(withApprovedImage(guide, approvals)?.illustration.photo).toMatchObject({ path: imagePath(p), alt: p.alt });
    expect(withApprovedImage(withApprovedImage(guide, approvals), new Set())?.illustration.photo).toBeUndefined();
    for (const original of [
      { ...guide, version: guide.version - 1 },
      { ...guide, author: "coach" as const },
    ])
      expect(withApprovedImage(original, approvals)).toBe(original);
  });
  it("publie une fiche relue une seule fois et retire un texte rouvert du catalogue approuvé pour l’IA", async () => {
    const p = catalogImages[0];
    const user = await makeUser("Relecture");
    await prisma.platformAdmin.create({ data: { email: user.email } });
    const cookie = await sessionCookie(user.email);
    const actor = (await getActorFrom(new Headers({ cookie })))!;
    await recordStepUp(actor.sessionId!, "passkey");
    const decide = (kind: "image" | "motion" | "text", ok: boolean) =>
      reviewEditorial(actor, p.key, p.guideVersion, kind, ok, stamp(p.key, p.guideVersion, kind));
    const find = () => prisma.exercise.findUnique({ where: { catalogKey: p.key } });
    try {
      await decide("text", true);
      await decide("image", true);
      expect(await find()).toBeNull();
      await Promise.all([decide("motion", true), decide("motion", true)]);
      const first = await find();
      expect(first?.guide).toMatchObject({ technicalReview: "approved" });
      await decide("text", false);
      expect((await find())?.guide).toMatchObject({ technicalReview: "pending" });
      await decide("text", true);
      expect((await find())?.id).toBe(first?.id);
    } finally {
      await prisma.exercise.deleteMany({ where: { catalogKey: p.key } });
      await prisma.platformSetting.deleteMany({ where: { key: { startsWith: "exerciseReview:" + p.key + ":" } } });
    }
  });
});
