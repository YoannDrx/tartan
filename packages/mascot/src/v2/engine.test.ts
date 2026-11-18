import { describe, expect, it } from "vitest";
import { EXERCISE_CLIPS } from "../exercises";
import { A_REPRENDRE } from "./a-reprendre";
import { brokenConstraints, motionEngine, motionLevel, REVIEW_BATCHES, reviewBatch } from "./engine";
import { guidePositionAt } from "./gesture";
import { GESTURES } from "./gestures";
import { GESTURE_KEYS, gestureEntry } from "./registry";

describe("choix du moteur par fiche", () => {
  it("le nouveau moteur prend les gestes écrits à la main et les gestes relevés sans contrainte violée", () => {
    for (const key of Object.keys(GESTURES)) {
      expect(motionEngine(key), key).toBe("v2");
      expect(motionLevel(key), key).toBe("ecrit");
    }
    expect(motionEngine("goblet-squat")).toBe("v2");
    expect(motionLevel("goblet-squat")).toBe("releve");
    expect(motionEngine("easy-continuous-run")).toBe("v2");
  });

  it("un geste à reprendre garde le premier moteur, et dit ce qu'il ne respecte pas", () => {
    for (const key of Object.keys(A_REPRENDRE)) {
      expect(motionEngine(key), key).toBe("v1");
      expect(motionLevel(key), key).toBe("a-reprendre");
      expect(brokenConstraints(key).length, key).toBeGreaterThan(0);
    }
    expect(brokenConstraints("snatch")).toEqual([]);
  });

  it("une fiche sans geste n'a pas de moteur", () => {
    for (const key of ["inconnu", "", null, undefined]) {
      expect(motionEngine(key)).toBeNull();
      expect(motionLevel(key)).toBeNull();
      expect(reviewBatch(key)).toBeUndefined();
    }
  });

  it("le compte : les 173 gestes sur le nouveau moteur, aucun sur le premier, d'accord avec le registre", () => {
    const engines = GESTURE_KEYS.map((key) => motionEngine(key));
    expect(engines.filter((engine) => engine === "v2")).toHaveLength(173);
    expect(engines.filter((engine) => engine === "v1")).toHaveLength(0);
    for (const key of GESTURE_KEYS) {
      const level = motionLevel(key);
      expect(level === "ecrit" ? "ecrit" : "releve", key).toBe(gestureEntry(key)!.level);
    }
    // Le premier appel relève tout le registre : sur une machine chargée, cela dépasse les cinq secondes par défaut.
  }, 30_000);

  it("un geste du nouveau moteur est une nouvelle série de relecture ; un geste resté sur le premier garde la sienne", () => {
    expect(REVIEW_BATCHES).toEqual(["face", "v2"]);
    expect(reviewBatch("snatch")).toBe("v2");
    expect(reviewBatch("jumping-jacks")).toBe("v2");
    // Gainage latéral : dessiné de face par le premier moteur, désormais écrit à la main dans le nouveau.
    expect(EXERCISE_CLIPS["side-plank"]!.batch).toBe("face");
    expect(reviewBatch("side-plank")).toBe("v2");
    expect(reviewBatch("good-morning")).toBe("v2");
    // Un geste resté sur le premier moteur garde sa série.
    for (const key of Object.keys(A_REPRENDRE)) expect(reviewBatch(key), key).toBe(EXERCISE_CLIPS[key]!.batch);
  });
});

describe("positions du guide", () => {
  it("chaque geste du registre illustre les quatre lignes du guide, dans l'ordre", () => {
    for (const key of GESTURE_KEYS) {
      const { clip } = gestureEntry(key)!;
      expect(
        clip.positions.map((position) => position.guide),
        key,
      ).toEqual([0, 1, 2, 3]);
      expect(clip.positions[0]!.from, key).toBe(0);
      expect(clip.positions[3]!.to, key).toBe(1);
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
