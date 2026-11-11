import { describe, expect, it } from "vitest";
import { ATHLETE_IDS, athleteRig, ATHLETES } from "./athletes";
import { POSES } from "./poses";
import { BIB, FACES, HAIRS, rig } from "./rig";
import { BODY, SKELETON, type AthletePaint } from "./skeleton";
import { svgAthlete } from "./svg";

const PAINT: AthletePaint = {
  skin: "skin",
  tee: "tee",
  shorts: "shorts",
  shoe: "shoe",
  hair: "hair",
  eye: "eye",
  bib: "bib",
  mark: "mark",
};
const bone = (bones: ReturnType<typeof rig>, id: string) => bones.find((item) => item.id === id);

describe("le corps d'un athlète", () => {
  it("garde le squelette de base et lui ajoute des mains", () => {
    const bones = rig({ hair: "crop", face: "neutral", bib: null });
    expect(bones.map((item) => item.id).sort()).toEqual(SKELETON.map((item) => item.id).sort());
    for (const side of ["A", "B"]) {
      const forearm = bone(bones, `forearm${side}`)!;
      expect(forearm.shapes.at(-1)).toEqual({ kind: "disc", x: 0, y: BODY.forearm, radius: 15, paint: "skin" });
    }
    // Le squelette de base, lui, n'a pas changé : le film et le mobile dessinent le même personnage qu'avant.
    expect(SKELETON.find((item) => item.id === "forearmA")!.shapes).toHaveLength(1);
  });

  it("est trié du fond vers le devant, chaque os après celui qui le porte dans la table", () => {
    for (const hair of HAIRS) {
      const bones = rig({ hair, face: "joy", bib: 4 });
      expect(bones.map((item) => item.z)).toEqual([...bones.map((item) => item.z)].sort((a, b) => a - b));
      const ids = new Set(bones.map((item) => item.id));
      for (const item of bones) if (item.parent) expect(ids.has(item.parent)).toBe(true);
    }
  });

  it("pose la coiffure derrière la tête, sauf la coupe courte qui n'en dépasse pas", () => {
    expect(bone(rig({ hair: "crop", face: "neutral", bib: null }), "hairBack")).toBeUndefined();
    for (const hair of ["bun", "ponytail", "afro"] as const) {
      const bones = rig({ hair, face: "neutral", bib: null });
      const back = bone(bones, "hairBack")!;
      expect(back.parent).toBe("head");
      expect(back.z).toBeLessThan(bone(bones, "head")!.z);
      expect(back.z).toBeGreaterThan(bone(bones, "torso")!.z);
      expect(back.shapes.every((shape) => shape.paint === "hair")).toBe(true);
    }
  });

  it("change de visage sans changer de corps", () => {
    const faces = FACES.map((face) => rig({ hair: "bun", face, bib: 2 }));
    const eyes = faces.map((bones) => JSON.stringify(bone(bones, "eyes")!.shapes));
    expect(new Set(eyes).size).toBe(FACES.length);
    for (const bones of faces) {
      expect(bones.map((item) => item.id)).toEqual(faces[0]!.map((item) => item.id));
      expect(bone(bones, "eyes")!.shapes.every((shape) => shape.paint === "eye")).toBe(true);
    }
  });

  it("écrit le numéro sur le dossard, dans ses bords", () => {
    for (let number = 1; number <= 8; number += 1) {
      const bib = bone(rig({ hair: "crop", face: "neutral", bib: number }), "bib")!;
      const [box, ...strokes] = bib.shapes;
      expect(box).toMatchObject({ kind: "box", paint: "bib", width: BIB.width, height: BIB.height });
      expect(strokes.length).toBeGreaterThan(0);
      for (const shape of strokes) {
        if (shape.kind !== "stroke") throw new Error("Un chiffre est fait de traits.");
        expect(shape.paint).toBe("mark");
        for (const point of [shape.from, shape.to]) {
          expect(Math.abs(point.x)).toBeLessThan(BIB.width / 2 - BIB.stroke);
          expect(Math.abs(point.y)).toBeLessThan(BIB.height / 2 - BIB.stroke);
        }
      }
    }
    expect(() => rig({ hair: "crop", face: "neutral", bib: 9 })).toThrow(/1 à 8/);
  });

  it("garde le numéro lisible quand le corps se retourne", () => {
    const bones = rig({ hair: "crop", face: "neutral", bib: 6 });
    const transform = (flip: number) =>
      svgAthlete(bones, { ...POSES.stand, flip }, PAINT).bones.find((item) => item.id === "bib")!.transform;
    expect(transform(1)).not.toContain("scale(-1 1)");
    expect(transform(-1).endsWith("scale(-1 1)")).toBe(true);
    // Seul le dossard se retourne : le visage, lui, suit le corps.
    const eyes = svgAthlete(bones, { ...POSES.stand, flip: -1 }, PAINT).bones.find((item) => item.id === "eyes")!;
    expect(eyes.transform).not.toContain("scale(-1 1)");
  });

  it("ne reconstruit pas deux fois le même corps", () => {
    expect(rig({ hair: "afro", face: "effort", bib: 3 })).toBe(rig({ hair: "afro", face: "effort", bib: 3 }));
  });
});

describe("le groupe", () => {
  it("compte six athlètes, un par couloir", () => {
    expect(ATHLETE_IDS).toHaveLength(6);
    expect(ATHLETE_IDS.map((id) => ATHLETES[id].bib)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(ATHLETE_IDS.map((id) => ATHLETES[id].hair)).size).toBe(HAIRS.length);
  });

  it("donne à chacun son corps, coloré de bout en bout", () => {
    for (const id of ATHLETE_IDS) {
      const figure = svgAthlete(athleteRig(id, "joy"), POSES.cheer, PAINT);
      const colors = figure.bones.flatMap((item) =>
        item.shapes.map((shape) =>
          "stroke" in shape && shape.stroke ? shape.stroke : "fill" in shape ? shape.fill : "",
        ),
      );
      expect(colors.every((color) => color in PAINT)).toBe(true);
      expect(new Set(colors)).toEqual(new Set(Object.keys(PAINT)));
    }
  });
});
