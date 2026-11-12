import {
  athletePaint,
  colorDistance,
  DISTINCT,
  stagePaint,
  SURFACES,
  type Surface,
} from "@tartan/design-tokens/athletes";
import { tokens } from "@tartan/design-tokens";
import { ATHLETE_IDS } from "@tartan/mascot/athletes";
import { CLIPS } from "@tartan/mascot/events";
import { describe, expect, it } from "vitest";

const SURFACE_NAMES = Object.keys(SURFACES) as Surface[];
const cases = ATHLETE_IDS.flatMap((id) => SURFACE_NAMES.map((surface) => [id, surface] as const));

describe("l'écart entre deux couleurs", () => {
  it("vaut zéro pour une couleur et elle-même, et un du noir au blanc", () => {
    expect(colorDistance("#C4442B", "#C4442B")).toBe(0);
    expect(colorDistance("#000000", "#FFFFFF")).toBeCloseTo(1, 3);
    expect(colorDistance("#15161A", "#F2F3F1")).toBeCloseTo(colorDistance("#F2F3F1", "#15161A"), 12);
  });

  it("sépare un brun de la piste, là où la luminance seule les confond", () => {
    // Le premier teint hâlé essayé : même clarté que la piste, donc invisible dessus.
    expect(colorDistance("#B9764B", SURFACES.piste)).toBeLessThan(DISTINCT);
    expect(colorDistance(tokens.color.athlete.tone.tan, SURFACES.piste)).toBeGreaterThanOrEqual(DISTINCT);
  });
});

describe("les teints et les cheveux du groupe", () => {
  it("se détachent de la piste, de l'encre et de la craie", () => {
    const { tone, hair } = tokens.color.athlete;
    for (const [name, value] of [...Object.entries(tone), ...Object.entries(hair)]) {
      for (const surface of SURFACE_NAMES) {
        expect(colorDistance(value, SURFACES[surface]), `${name} sur ${surface}`).toBeGreaterThanOrEqual(DISTINCT);
      }
    }
  });

  it("gardent le teint du personnage d'origine", () => {
    expect(tokens.color.athlete.tone.peach).toBe(tokens.color.film.skin);
    expect(athletePaint("highJump", "ink").skin).toBe(tokens.color.film.skin);
  });
});

describe.each(cases)("%s sur %s", (id, surface) => {
  const paint = athletePaint(id, surface);
  const ground = SURFACES[surface];
  const apart = (a: string, b: string) => colorDistance(a, b);

  it("se lit sur son fond : peau, cheveux, maillot, short, pointes", () => {
    for (const part of ["skin", "hair", "tee", "shorts", "shoe"] as const) {
      expect(apart(paint[part], ground), part).toBeGreaterThanOrEqual(DISTINCT);
    }
  });

  it("ne confond pas deux parties voisines du corps", () => {
    // Les bras passent devant le maillot, les cuisses sortent du short, les cheveux coiffent le visage.
    expect(apart(paint.skin, paint.tee)).toBeGreaterThanOrEqual(DISTINCT);
    expect(apart(paint.skin, paint.shorts)).toBeGreaterThanOrEqual(DISTINCT);
    expect(apart(paint.skin, paint.hair)).toBeGreaterThanOrEqual(DISTINCT);
    expect(apart(paint.skin, paint.eye)).toBeGreaterThanOrEqual(DISTINCT);
    expect(apart(paint.tee, paint.shorts)).toBeGreaterThanOrEqual(DISTINCT);
  });

  it("porte un dossard lisible", () => {
    expect(apart(paint.bib, paint.tee)).toBeGreaterThanOrEqual(DISTINCT);
    expect(apart(paint.mark, paint.bib)).toBeGreaterThan(0.7);
  });
});

describe("le groupe", () => {
  it("ne compte pas deux athlètes habillés et coiffés pareil", () => {
    for (const surface of SURFACE_NAMES) {
      const looks = ATHLETE_IDS.map((id) => {
        const { skin, hair, tee, shorts } = athletePaint(id, surface);
        return [skin, hair, tee, shorts].join(" ");
      });
      expect(new Set(looks).size).toBe(ATHLETE_IDS.length);
    }
  });

  it("garde ses teints et ses cheveux d'un fond à l'autre", () => {
    for (const id of ATHLETE_IDS) {
      const [first, ...others] = SURFACE_NAMES.map((surface) => athletePaint(id, surface));
      for (const other of others) {
        expect(other.skin).toBe(first!.skin);
        expect(other.hair).toBe(first!.hair);
      }
    }
  });

  it("emploie les quatre teints", () => {
    const tones = new Set(ATHLETE_IDS.map((id) => athletePaint(id, "ink").skin));
    expect(tones).toEqual(new Set(Object.values(tokens.color.athlete.tone)));
  });
});

describe("les accessoires", () => {
  it("se lisent sur l'encre comme sur la piste", () => {
    for (const surface of ["ink", "piste"] as const) {
      const paint = stagePaint(surface);
      for (const [role, value] of Object.entries(paint)) {
        // Le dessus rouge du sautoir, comme ceux des stades, ne se détache pas du rouge de la piste : c'est son liseré
        // blanc (« board ») qui l'en sépare. Il se détache en revanche du corps bleu du tapis.
        if (role === "matTop" && surface === "piste") {
          expect(colorDistance(paint.board, SURFACES.piste)).toBeGreaterThanOrEqual(DISTINCT);
          expect(colorDistance(value, paint.mat)).toBeGreaterThanOrEqual(DISTINCT);
          continue;
        }
        expect(colorDistance(value, SURFACES[surface]), `${role} sur ${surface}`).toBeGreaterThanOrEqual(DISTINCT);
      }
      // Le sable et le tapis ne se confondent pas avec la peau la plus claire.
      expect(colorDistance(paint.sand, tokens.color.athlete.tone.light)).toBeGreaterThan(0.05);
    }
  });

  it("donnent au dessus de chaque sautoir son liseré blanc", () => {
    for (const id of ["highJump", "poleVault"] as const) {
      const shapes = CLIPS[id].props(0.5);
      expect(shapes.some((shape) => shape.paint === "matTop")).toBe(true);
      expect(shapes.some((shape) => shape.paint === "board" && shape.kind === "line")).toBe(true);
    }
  });
});
