// Le corps d'un athlète du groupe : le squelette de base, plus des mains, un visage, une coiffure et un dossard.
// Une seule morphologie : seuls changent ce qui se pose dessus.
import { BODY, SKELETON, type Bone, type Point, type Shape } from "./skeleton";

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

const CAP: Shape = { kind: "cap", radius: 44, chord: at(43, -10), paint: "hair" };

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

const build = ({ hair, face, bib }: Look): Bone[] => {
  const bones: Bone[] = SKELETON.map((bone) => {
    if (bone.id === "head") return { ...bone, shapes: [bone.shapes[0]!, CAP] };
    if (bone.id === "eyes") return { ...bone, shapes: FACE[face] };
    if (bone.id === "forearmA" || bone.id === "forearmB") return { ...bone, shapes: [...bone.shapes, HAND] };
    return bone;
  });
  if (HAIR_BACK[hair].length > 0) {
    bones.push({ id: "hairBack", parent: "head", offset: at(0, 0), turn: null, shapes: HAIR_BACK[hair], z: 6.5 });
  }
  if (bib !== null) {
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

// Les os d'un athlète, du fond vers le devant : prêts pour `svgAthlete` et `drawMascot`.
export const rig = (look: Look): readonly Bone[] => {
  const key = `${look.hair}/${look.face}/${look.bib}`;
  let bones = cache.get(key);
  if (!bones) {
    bones = build(look);
    cache.set(key, bones);
  }
  return bones;
};
