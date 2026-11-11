// Les couleurs du groupe : le teint, les cheveux et la tenue de chaque athlète, sur le fond où il est posé.
import type { AthleteId } from "@tartan/mascot/athletes";
import type { PropPaint } from "@tartan/mascot/props";
import type { AthletePaint } from "@tartan/mascot/skeleton";
import { tokens } from "./index";

const { color, scene } = tokens;

// Les trois fonds de la direction artistique.
export const SURFACES = { piste: scene.page, ink: color.ink, chalk: color.bg } as const;
export type Surface = keyof typeof SURFACES;

// L'écart entre deux couleurs, dans l'espace Oklab : 0 pour deux couleurs identiques, 1 du noir au blanc.
// Un contraste de luminance ne suffirait pas : un brun et le rouge de la piste ont la même clarté.
const linear = (channel: number) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const oklab = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((index) => linear(parseInt(hex.slice(index, index + 2), 16))) as [
    number,
    number,
    number,
  ];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ] as const;
};
export const colorDistance = (a: string, b: string) => {
  const [first, second] = [oklab(a), oklab(b)];
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
};

// En dessous, deux aplats voisins se confondent.
export const DISTINCT = 0.12;

const { lime, electric, sun } = color.film;
const { white, ink } = color;
const { tone, hair } = color.athlete;

// Une pièce de tenue : sa couleur, puis celle qui la remplace quand la première se perd dans le fond.
type Choice = readonly [string, ...string[]];
type Kit = { skin: string; hair: string; tee: Choice; shorts: Choice; shoe: Choice };

const KITS: Record<AthleteId, Kit> = {
  hurdles: { skin: tone.light, hair: hair.brown, tee: [lime], shorts: [electric], shoe: [white, ink] },
  poleVault: { skin: tone.deep, hair: hair.blond, tee: [electric], shorts: [sun], shoe: [white, ink] },
  tripleJump: { skin: tone.tan, hair: hair.brown, tee: [sun], shorts: [electric], shoe: [lime] },
  discus: { skin: tone.tan, hair: hair.brown, tee: [ink, white], shorts: [lime], shoe: [white, ink] },
  longJump: { skin: tone.peach, hair: hair.chestnut, tee: [electric], shorts: [lime], shoe: [white, ink] },
  // Le personnage d'origine : maillot blanc, short bleu, pointes citron. Sur la craie, son maillot passe au rouge piste.
  highJump: { skin: tone.peach, hair: hair.brown, tee: [white, color.brand], shorts: [electric], shoe: [lime] },
};

const first = (choice: readonly string[], ...against: string[]) =>
  choice.find((candidate) => against.every((other) => colorDistance(candidate, other) >= DISTINCT)) ?? choice[0]!;

// Les couleurs d'un athlète sur un fond. Le dossard se détache du maillot, son numéro du dossard.
export const athletePaint = (id: AthleteId, surface: Surface): AthletePaint => {
  const kit = KITS[id];
  const ground = SURFACES[surface];
  const tee = first(kit.tee, ground);
  const bib = first([white, ink], tee);
  return {
    skin: kit.skin,
    hair: kit.hair,
    eye: ink,
    tee,
    shorts: first(kit.shorts, ground, tee),
    shoe: first(kit.shoe, ground),
    bib,
    mark: bib === white ? ink : white,
  };
};

// Les couleurs des accessoires. La scène des gestes est encre ou piste : pas de sautoir sur la craie.
export const stagePaint = (surface: Exclude<Surface, "chalk">): PropPaint => ({
  lane: scene.lane,
  bar: lime,
  post: surface === "ink" ? color.mutedOnInk : white,
  mat: sun,
  matTop: color.film.sunLight,
  sand: color.film.sunLight,
  board: white,
  // La plasticine : rouge piste, sauf sur la piste, où elle disparaîtrait.
  foul: surface === "ink" ? color.brand : ink,
  pole: lime,
  hurdle: white,
  discus: surface === "ink" ? sun : ink,
});
