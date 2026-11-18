import { AVATAR_ANIMAL_IDS, AVATAR_GROUP_IDS } from "@tartan/contracts";
import { tokens } from "@tartan/design-tokens";
import { colorDistance, DISTINCT } from "@tartan/design-tokens/athletes";
import { ANIMAL_PAINT, ATHLETE_AVATAR_SURFACE, AVATAR_GROUNDS } from "@tartan/design-tokens/avatars";
import { describe, expect, it } from "vitest";

// Les avatars prédéfinis se lisent à 24 pixels, sur une carte encre comme sur une surface claire.
describe("les couleurs des avatars", () => {
  it("chaque animal et chaque athlète du groupe a ses couleurs", () => {
    expect(Object.keys(ANIMAL_PAINT).sort()).toEqual([...AVATAR_ANIMAL_IDS].sort());
    expect(Object.keys(ATHLETE_AVATAR_SURFACE).sort()).toEqual([...AVATAR_GROUP_IDS].sort());
  });

  it("le disque se voit sur l'encre comme sur une surface blanche", () => {
    for (const [name, ground] of Object.entries(AVATAR_GROUNDS)) {
      expect(colorDistance(ground, tokens.color.ink), `${name} sur l'encre`).toBeGreaterThanOrEqual(DISTINCT);
      expect(colorDistance(ground, tokens.color.white), `${name} sur le blanc`).toBeGreaterThanOrEqual(DISTINCT);
    }
  });

  it("chaque animal se détache de son disque, et son museau de son pelage", () => {
    for (const [id, paint] of Object.entries(ANIMAL_PAINT)) {
      expect(colorDistance(paint.main, paint.ground), `${id} : pelage sur le disque`).toBeGreaterThanOrEqual(DISTINCT);
      expect(colorDistance(paint.dark, paint.ground), `${id} : oreilles sur le disque`).toBeGreaterThanOrEqual(
        DISTINCT,
      );
      expect(colorDistance(paint.eye, paint.ground), `${id} : yeux sur le disque`).toBeGreaterThanOrEqual(DISTINCT);
      if (paint.light !== paint.main) {
        expect(colorDistance(paint.light, paint.main), `${id} : museau sur le pelage`).toBeGreaterThanOrEqual(DISTINCT);
      }
    }
  });
});
