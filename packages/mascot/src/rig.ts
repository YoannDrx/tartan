// Le corps d'un athlète du groupe : le squelette de base, plus des mains, un visage, une coiffure et un dossard.
// Une seule morphologie : seuls changent ce qui se pose dessus.
import { BODY, skeletonOf, type Bone, type Point, type Shape, type View } from "./skeleton";

export const HAIRS = ["crop", "bun", "ponytail", "afro"] as const;
export type Hair = (typeof HAIRS)[number];

export const FACES = ["neutral", "effort", "joy"] as const;
export type Face = (typeof FACES)[number];

// `bib` : le numéro du dossard, de 1 à 8 comme les couloirs. `null` : pas de dossard.
export type Look = { hair: Hair; face: Face; bib: number | null };

const EYE = 6;
const stroke = (from: Point, to: Point, width: number, paint: Shape["paint"] = "eye"): Shape => ({
  kind: "stroke",
  from,
  to,
  width,
  paint,
});
const at = (x: number, y: number): Point => ({ x, y });

// Le visage regarde vers la droite, comme le corps : les deux yeux sont du même côté de la tête.
const FACE: Record<Face, Shape[]> = {
  neutral: [
    { kind: "disc", x: 15, y: 6, radius: EYE, paint: "eye" },
    { kind: "disc", x: 31, y: 6, radius: EYE, paint: "eye" },
    stroke(at(19, 25), at(29, 25), 4),
  ],
  // Les yeux plissés, les dents serrées.
  effort: [
    stroke(at(9, 2), at(20, 8), 5),
    stroke(at(37, 2), at(26, 8), 5),
    { kind: "box", x: 16, y: 20, width: 16, height: 9, radius: 4, paint: "eye" },
  ],
  // Les yeux en chevrons, la bouche ouverte.
  joy: [
    stroke(at(9, 9), at(15, 3), 4.5),
    stroke(at(15, 3), at(21, 9), 4.5),
    stroke(at(25, 9), at(31, 3), 4.5),
    stroke(at(31, 3), at(37, 9), 4.5),
    { kind: "segment", x: 24, y: 19, radius: 11, from: 0, to: 180, paint: "eye" },
  ],
};

// Le même visage, vu de face : les yeux de part et d'autre du milieu, la bouche au centre.
const FRONT_FACE: Record<Face, Shape[]> = {
  neutral: [
    { kind: "disc", x: -13, y: 6, radius: EYE, paint: "eye" },
    { kind: "disc", x: 13, y: 6, radius: EYE, paint: "eye" },
    stroke(at(-5, 25), at(5, 25), 4),
  ],
  effort: [
    stroke(at(-20, 2), at(-9, 8), 5),
    stroke(at(20, 2), at(9, 8), 5),
    { kind: "box", x: -8, y: 20, width: 16, height: 9, radius: 4, paint: "eye" },
  ],
  joy: [
    stroke(at(-20, 9), at(-14, 3), 4.5),
    stroke(at(-14, 3), at(-8, 9), 4.5),
    stroke(at(8, 9), at(14, 3), 4.5),
    stroke(at(14, 3), at(20, 9), 4.5),
    { kind: "segment", x: 0, y: 19, radius: 11, from: 0, to: 180, paint: "eye" },
  ],
};

const CAP: Shape = { kind: "cap", radius: 44, chord: at(43, -10), paint: "hair" };

// Vu de face, ce qui dépasse derrière la tête : un chignon au sommet, une queue de cheval sur le côté.
const FRONT_HAIR_BACK: Record<Hair, Shape[]> = {
  crop: [],
  bun: [{ kind: "disc", x: 0, y: -50, radius: 18, paint: "hair" }],
  ponytail: [stroke(at(-36, -12), at(-50, 22), 15, "hair"), stroke(at(-50, 22), at(-50, 46), 12, "hair")],
  afro: [{ kind: "disc", x: 0, y: -12, radius: 56, paint: "hair" }],
};

// Vu de dos (allongé sur le ventre, vu d'en haut) : l'arrière de la tête, sans visage.
const BACK_HAIR: Record<Hair, Shape[]> = {
  crop: [],
  bun: [{ kind: "disc", x: 0, y: -26, radius: 18, paint: "hair" }],
  ponytail: [stroke(at(0, 4), at(0, 40), 14, "hair")],
  afro: [],
};

// Ce qui dépasse derrière la tête, dessiné sous elle.
const HAIR_BACK: Record<Hair, Shape[]> = {
  crop: [],
  bun: [{ kind: "disc", x: -30, y: -44, radius: 18, paint: "hair" }],
  ponytail: [stroke(at(-34, -18), at(-66, 10), 18, "hair"), stroke(at(-66, 10), at(-70, 40), 13, "hair")],
  afro: [{ kind: "disc", x: -4, y: -12, radius: 56, paint: "hair" }],
};

// Les chiffres du dossard, à la manière d'un tableau d'affichage : des traits sur une grille de 3 sur 5.
const DIGITS: Record<number, number[][][]> = {
  1: [
    [
      [1, 0],
      [1, 4],
    ],
  ],
  2: [
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 4],
      [2, 4],
    ],
  ],
  3: [
    [
      [0, 0],
      [2, 0],
      [2, 4],
      [0, 4],
    ],
    // La barre du milieu, plus courte : sans elle, le 3 se lit comme un E retourné.
    [
      [0.9, 2],
      [2, 2],
    ],
  ],
  4: [
    [
      [0, 0],
      [0, 2],
      [2, 2],
    ],
    [
      [2, 0],
      [2, 4],
    ],
  ],
  5: [
    [
      [2, 0],
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 4],
      [0, 4],
    ],
  ],
  6: [
    [
      [2, 0],
      [0, 0],
      [0, 4],
      [2, 4],
      [2, 2],
      [0, 2],
    ],
  ],
  7: [
    [
      [0, 0],
      [2, 0],
      [2, 4],
    ],
  ],
  8: [
    [
      [0, 0],
      [2, 0],
      [2, 4],
      [0, 4],
      [0, 0],
    ],
    [
      [0, 2],
      [2, 2],
    ],
  ],
};

export const BIB = { width: 46, height: 38, radius: 7, cell: { x: 6, y: 5.5 }, stroke: 4.5 };

// Le dossard est centré sur son os : retourné, il reste à sa place.
const bibShapes = (number: number): Shape[] => {
  const glyph = DIGITS[number];
  if (!glyph) throw new Error(`Dossard ${number} : les numéros vont de 1 à 8.`);
  const point = ([x, y]: number[]): Point => at((x! - 1) * BIB.cell.x, (y! - 2) * BIB.cell.y);
  return [
    {
      kind: "box",
      x: -BIB.width / 2,
      y: -BIB.height / 2,
      width: BIB.width,
      height: BIB.height,
      radius: BIB.radius,
      paint: "bib",
    },
    ...glyph.flatMap((line) =>
      line.slice(1).map((to, index) => stroke(point(line[index]!), point(to), BIB.stroke, "mark")),
    ),
  ];
};

const HAND: Shape = { kind: "disc", x: 0, y: BODY.forearm, radius: 15, paint: "skin" };

const build = ({ hair, face, bib }: Look, view: View): Bone[] => {
  const back = view === "back";
  const bones: Bone[] = skeletonOf(view).map((bone) => {
    if (bone.id === "head")
      return {
        ...bone,
        // De dos, la chevelure couvre la tête ; une coupe afro garde son volume.
        shapes: back
          ? [bone.shapes[0]!, { kind: "disc", x: 0, y: 0, radius: hair === "afro" ? 56 : 42, paint: "hair" }]
          : [bone.shapes[0]!, CAP],
      };
    if (bone.id === "eyes") return { ...bone, shapes: back ? [] : view === "front" ? FRONT_FACE[face] : FACE[face] };
    if (bone.id === "forearmA" || bone.id === "forearmB") return { ...bone, shapes: [...bone.shapes, HAND] };
    return bone;
  });
  const behind = view === "side" ? HAIR_BACK[hair] : view === "front" ? FRONT_HAIR_BACK[hair] : BACK_HAIR[hair];
  if (behind.length > 0) {
    // De dos, le chignon et la queue de cheval se voient par-dessus la tête.
    bones.push({ id: "hairBack", parent: "head", offset: at(0, 0), turn: null, shapes: behind, z: back ? 7.5 : 6.5 });
  }
  if (bib !== null && view === "front") {
    bones.push({
      id: "bib",
      parent: "torso",
      offset: at(0, -BODY.torso * 0.58),
      turn: null,
      shapes: bibShapes(bib),
      z: 6.2,
      upright: true,
    });
  }
  if (bib !== null && view === "side") {
    bones.push({
      id: "bib",
      parent: "torso",
      // Vers l'avant du buste : le bras, attaché au milieu de l'épaule, ne cache pas le numéro.
      offset: at(12, -BODY.torso * 0.62),
      turn: null,
      shapes: bibShapes(bib),
      z: 6.2,
      upright: true,
    });
  }
  return bones.sort((a, b) => a.z - b.z);
};

const cache = new Map<string, readonly Bone[]>();

// Les os d'un athlète, du fond vers le devant : la tête, la coiffure, le visage et le dossard que le corps du
// moteur des gestes reprend (v2/draw-svg.ts).
export const rig = (look: Look, view: View = "side"): readonly Bone[] => {
  const key = `${look.hair}/${look.face}/${look.bib}/${view}`;
  let bones = cache.get(key);
  if (!bones) {
    bones = build(look, view);
    cache.set(key, bones);
  }
  return bones;
};
