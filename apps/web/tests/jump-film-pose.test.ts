import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { poseAt, TRAIL_PATH } from "@/features/landing/jump-film-pose";

// Référence figée le 11 novembre 2026, avant l'unification du squelette : 200 positions de défilement, de 0 à 1.
// Elle ne se régénère pas : un écart veut dire que le saut du film a changé.
const reference = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "fixtures/jump-film-poses.json"), "utf8"),
) as { keys: string[]; rows: number[][]; trailPath: string };

describe("film du saut", () => {
  it("rend les 200 poses de référence", () => {
    expect(reference.rows).toHaveLength(200);
    for (const [t = 0, ...values] of reference.rows) {
      const pose: Record<string, number> = poseAt(t);
      expect(Object.keys(pose).sort()).toEqual([...reference.keys].sort());
      reference.keys.forEach((key, index) => {
        expect(pose[key], `${key} à t = ${t}`).toBeCloseTo(values[index]!, 9);
      });
    }
  });

  it("trace la même ligne de couloir", () => {
    expect(TRAIL_PATH).toBe(reference.trailPath);
  });
});
