// Les animaux de Tartan : dessinés pour le produit, en aplats, de face, sur un disque de la palette vive.
// Même langage que le groupe : formes pleines aux bouts ronds, yeux et truffe à l'encre, aucun contour.
// Source unique des dessins : le web (`avatar-art.tsx`) et l'app native (`src/ui/avatar-art.tsx`) les rendent tels
// quels, dans un carré de 100. Les couleurs sont nommées par rôle ; leurs valeurs vivent dans
// `@tartan/design-tokens/avatars` (`ANIMAL_PAINT`).

export const ANIMAL_IDS = [
  "fox",
  "cat",
  "dog",
  "bear",
  "rabbit",
  "owl",
  "panda",
  "lion",
  "frog",
  "penguin",
  "koala",
  "hedgehog",
] as const;
export type AnimalId = (typeof ANIMAL_IDS)[number];

// Le rôle d'un aplat : la teinte principale, une claire (museau, ventre), une sombre (oreilles, taches), les yeux et
// la truffe, un détail de couleur (intérieur des oreilles, bec, joues).
export type AnimalTone = "main" | "light" | "dark" | "eye" | "accent";

export type AnimalShape =
  | { tag: "path"; d: string; tone: AnimalTone; stroke?: false }
  // Un trait (la bouche de la grenouille) : sans remplissage, aux bouts ronds.
  | { tag: "path"; d: string; tone: AnimalTone; stroke: true; strokeWidth: number }
  | { tag: "circle"; cx: number; cy: number; r: number; tone: AnimalTone }
  | { tag: "ellipse"; cx: number; cy: number; rx: number; ry: number; tone: AnimalTone; rotate?: Rotation }
  | {
      tag: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      rx: number;
      tone: AnimalTone;
      rotate?: Rotation;
    }
  | { tag: "polygon"; points: string; tone: AnimalTone };

// Une rotation en degrés autour d'un point, comme l'attribut SVG `rotate(deg x y)` des dessins d'origine.
export type Rotation = { deg: number; x: number; y: number };

const ring = (count: number, radius: number, from: number, to: number) =>
  Array.from({ length: count }, (_, i) => {
    const angle = ((from + ((to - from) * i) / (count - 1)) * Math.PI) / 180;
    return [50 + radius * Math.cos(angle), 58 + radius * Math.sin(angle)] as const;
  });

// Les piquants du hérisson : une couronne de pointes sur le haut de la tête.
const spikes = (() => {
  const points: string[] = [];
  const tips = 11;
  for (let i = 0; i <= tips * 2; i += 1) {
    const angle = ((160 + (220 * i) / (tips * 2)) * Math.PI) / 180;
    const radius = i % 2 === 0 ? 33 : 44;
    points.push(`${(50 + radius * Math.cos(angle)).toFixed(1)},${(58 + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return points.join(" ");
})();

const path = (d: string, tone: AnimalTone): AnimalShape => ({ tag: "path", d, tone });
const circle = (cx: number, cy: number, r: number, tone: AnimalTone): AnimalShape => ({
  tag: "circle",
  cx,
  cy,
  r,
  tone,
});
const ellipse = (cx: number, cy: number, rx: number, ry: number, tone: AnimalTone, rotate?: number): AnimalShape => ({
  tag: "ellipse",
  cx,
  cy,
  rx,
  ry,
  tone,
  ...(rotate ? { rotate: { deg: rotate, x: cx, y: cy } } : {}),
});

export const ANIMAL_SHAPES: Record<AnimalId, readonly AnimalShape[]> = {
  fox: [
    path("M20 42 L30 10 L46 32 Z M80 42 L70 10 L54 32 Z", "main"),
    path("M27 34 L31 19 L39 31 Z M73 34 L69 19 L61 31 Z", "dark"),
    path("M16 42 C18 30 34 28 50 28 C66 28 82 30 84 42 C80 58 64 74 50 86 C36 74 20 58 16 42 Z", "main"),
    path("M16 42 C26 50 38 54 46 66 L50 86 C36 74 20 58 16 42 Z", "light"),
    path("M84 42 C74 50 62 54 54 66 L50 86 C64 74 80 58 84 42 Z", "light"),
    circle(38, 47, 4, "eye"),
    circle(62, 47, 4, "eye"),
    ellipse(50, 80, 4.5, 3.5, "eye"),
  ],
  cat: [
    path("M20 46 L25 14 L46 32 Z M80 46 L75 14 L54 32 Z", "main"),
    path("M27 38 L29 23 L39 32 Z M73 38 L71 23 L61 32 Z", "accent"),
    ellipse(50, 58, 32, 28, "main"),
    { tag: "rect", x: 47.5, y: 31, width: 5, height: 10, rx: 2.5, tone: "dark" },
    { tag: "rect", x: 38, y: 33, width: 4.5, height: 8, rx: 2.25, tone: "dark", rotate: { deg: -18, x: 40, y: 37 } },
    { tag: "rect", x: 57.5, y: 33, width: 4.5, height: 8, rx: 2.25, tone: "dark", rotate: { deg: 18, x: 60, y: 37 } },
    ellipse(50, 69, 13, 9, "light"),
    ellipse(38, 54, 3.5, 5, "eye"),
    ellipse(62, 54, 3.5, 5, "eye"),
    path("M45.5 63 L54.5 63 L50 68 Z", "accent"),
  ],
  dog: [
    ellipse(50, 56, 27, 29, "main"),
    ellipse(25, 52, 10, 21, "dark", 14),
    ellipse(75, 52, 10, 21, "dark", -14),
    ellipse(50, 70, 16, 13, "light"),
    ellipse(50, 80, 4.5, 5, "accent"),
    circle(40, 50, 4, "eye"),
    circle(60, 50, 4, "eye"),
    ellipse(50, 64, 6.5, 4.5, "eye"),
  ],
  bear: [
    circle(25, 31, 12, "main"),
    circle(75, 31, 12, "main"),
    circle(25, 31, 6.5, "light"),
    circle(75, 31, 6.5, "light"),
    circle(50, 57, 31, "main"),
    ellipse(50, 68, 15, 12, "light"),
    circle(38, 51, 4, "eye"),
    circle(62, 51, 4, "eye"),
    ellipse(50, 62, 6.5, 4.5, "eye"),
  ],
  rabbit: [
    ellipse(37, 26, 9, 25, "main", -10),
    ellipse(63, 26, 9, 25, "main", 10),
    ellipse(37, 27, 4.5, 18, "accent", -10),
    ellipse(63, 27, 4.5, 18, "accent", 10),
    ellipse(50, 64, 27, 25, "main"),
    circle(41, 60, 4, "eye"),
    circle(59, 60, 4, "eye"),
    path("M45.5 68 L54.5 68 L50 73 Z", "accent"),
    ellipse(34, 71, 5, 3, "accent"),
    ellipse(66, 71, 5, 3, "accent"),
  ],
  owl: [
    path("M21 38 L25 14 L42 30 Z M79 38 L75 14 L58 30 Z", "main"),
    ellipse(50, 60, 31, 33, "main"),
    circle(38, 52, 12.5, "light"),
    circle(62, 52, 12.5, "light"),
    circle(38, 53, 6, "eye"),
    circle(62, 53, 6, "eye"),
    path("M45 63 L55 63 L50 73 Z", "accent"),
    circle(41, 83, 3.5, "dark"),
    circle(50, 85, 3.5, "dark"),
    circle(59, 83, 3.5, "dark"),
  ],
  panda: [
    circle(25, 32, 12, "dark"),
    circle(75, 32, 12, "dark"),
    ellipse(50, 58, 31, 28, "main"),
    ellipse(38, 55, 8, 11, "dark", 35),
    ellipse(62, 55, 8, 11, "dark", -35),
    circle(39, 53, 3, "light"),
    circle(61, 53, 3, "light"),
    ellipse(50, 66, 5.5, 4, "eye"),
    ellipse(34, 70, 5, 3, "accent"),
    ellipse(66, 70, 5, 3, "accent"),
  ],
  lion: [
    ...ring(12, 33, 0, 330).map(([x, y]) => circle(x, y, 11, "dark")),
    circle(50, 58, 33, "dark"),
    circle(33, 38, 7, "main"),
    circle(67, 38, 7, "main"),
    circle(50, 59, 24, "main"),
    ellipse(50, 69, 12, 8.5, "light"),
    circle(42, 54, 3.5, "eye"),
    circle(58, 54, 3.5, "eye"),
    path("M45 62 L55 62 L50 68 Z", "accent"),
  ],
  frog: [
    circle(31, 40, 13, "main"),
    circle(69, 40, 13, "main"),
    ellipse(50, 63, 35, 25, "main"),
    ellipse(50, 76, 24, 10, "light"),
    circle(31, 40, 8.5, "accent"),
    circle(69, 40, 8.5, "accent"),
    circle(31, 41, 4.5, "eye"),
    circle(69, 41, 4.5, "eye"),
    { tag: "path", d: "M35 60 Q50 71 65 60", tone: "eye", stroke: true, strokeWidth: 3.5 },
  ],
  penguin: [
    ellipse(50, 58, 31, 33, "main"),
    circle(40, 58, 14, "light"),
    circle(60, 58, 14, "light"),
    ellipse(50, 71, 19, 15, "light"),
    circle(41, 55, 4, "eye"),
    circle(59, 55, 4, "eye"),
    path("M44 64 L56 64 L50 74 Z", "accent"),
  ],
  koala: [
    circle(22, 40, 16, "main"),
    circle(78, 40, 16, "main"),
    circle(22, 40, 9, "accent"),
    circle(78, 40, 9, "accent"),
    ellipse(50, 59, 29, 27, "main"),
    ellipse(50, 78, 13, 6, "light"),
    circle(37, 53, 3.5, "eye"),
    circle(63, 53, 3.5, "eye"),
    ellipse(50, 63, 8.5, 11, "dark"),
  ],
  hedgehog: [
    { tag: "polygon", points: spikes, tone: "dark" },
    circle(50, 58, 33, "main"),
    ellipse(50, 68, 23, 19, "light"),
    circle(42, 63, 3.5, "eye"),
    circle(58, 63, 3.5, "eye"),
    circle(50, 73, 4.5, "eye"),
  ],
};

// La rotation d'une forme, en attribut SVG `transform`, ou rien.
export const shapeTransform = (shape: AnimalShape): string | undefined =>
  (shape.tag === "ellipse" || shape.tag === "rect") && shape.rotate
    ? `rotate(${shape.rotate.deg} ${shape.rotate.x} ${shape.rotate.y})`
    : undefined;
