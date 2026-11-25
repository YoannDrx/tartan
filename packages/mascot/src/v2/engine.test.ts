import { describe, expect, it } from "vitest";
import { STADIUM_GESTURES } from "./gestures/stadium";
import { motionEngine, motionLevel } from "./engine";
import { guidePositionAt } from "./gesture";
import { GESTURES } from "./gestures";
import { GESTURE_KEYS, gestureEntry } from "./registry";

describe("moteur et niveau par fiche", () => {
  it("toute fiche qui a un geste le joue avec le nouveau corps, écrit à la main ou relevé", () => {
    for (const key of Object.keys(GESTURES)) {
      expect(motionEngine(key), key).toBe("v2");
      expect(motionLevel(key), key).toBe("ecrit");
    }
    expect(motionEngine("goblet-squat")).toBe("v2");
    expect(motionLevel("goblet-squat")).toBe("releve");
    expect(motionEngine("easy-continuous-run")).toBe("v2");
  });

  it("une fiche sans geste n'a pas de moteur", () => {
    for (const key of ["inconnu", "", null, undefined]) {
      expect(motionEngine(key)).toBeNull();
      expect(motionLevel(key)).toBeNull();
    }
  });

  it("le compte : tous les gestes sur le nouveau moteur, d'accord avec le registre", () => {
    const engines = GESTURE_KEYS.map((key) => motionEngine(key));
    expect(engines.filter((engine) => engine === "v2")).toHaveLength(GESTURE_KEYS.length);
    for (const key of GESTURE_KEYS) expect(motionLevel(key), key).toBe(gestureEntry(key)!.level);
    // Le premier appel relève tout le registre : sur une machine chargée, cela dépasse les cinq secondes par défaut.
  }, 30_000);
});

describe("positions du guide", () => {
  it("chaque geste du registre illustre chaque ligne du guide, dans l'ordre", () => {
    for (const key of GESTURE_KEYS) {
      const { clip } = gestureEntry(key)!;
      expect(
        clip.positions.map((position) => position.guide),
        key,
      ).toEqual(STADIUM_GESTURES.includes(clip) ? [0, 1, 2] : [0, 1, 2, 3]);
      expect(clip.positions[0]!.from, key).toBe(0);
      expect(clip.positions.at(-1)!.to, key).toBe(1);
      for (const [index, position] of clip.positions.entries()) {
        if (index > 0) expect(position.from, key).toBe(clip.positions[index - 1]!.to);
        expect(position.to, key).toBeGreaterThan(position.from);
      }
    }
  });

  it("la lecture sait sur quelle position elle est, et où s'arrêter pour la montrer", () => {
    for (const key of ["snatch", "back-squat", "front-squat", "easy-continuous-run"]) {
      const { clip } = gestureEntry(key)!;
      clip.positions.forEach((position, index) => {
        expect(guidePositionAt(clip, (position.from + position.to) / 2), key).toBe(index);
        expect(guidePositionAt(clip, position.still), `${key} ${index}`).toBe(index);
      });
      expect(guidePositionAt(clip, 1)).toBe(0);
      expect(guidePositionAt(clip, -0.001)).toBe(3);
    }
  });
});
