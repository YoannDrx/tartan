// Les couleurs des avatars prédéfinis : le fond rond de chacun, et les aplats des animaux dessinés pour Tartan.
// Un fond n'est jamais l'encre ni la craie : le disque doit se voir sur une carte encre comme sur une surface claire.
// Chaque aplat se détache de son fond d'au moins `DISTINCT` (Oklab) : `apps/web/tests/avatar-colors.test.ts`.
import type { Surface } from "./athletes";
import { tokens } from "./index";

const { color } = tokens;
const { electric, lime, sun } = color.film;

// Les fonds des disques : trois couleurs de la palette vive et la piste.
export const AVATAR_GROUNDS = {
  piste: color.brand,
  lane: electric,
  lime,
  sun,
} as const;
export type AvatarGround = keyof typeof AVATAR_GROUNDS;

// Les athlètes du groupe sont posés sur un fond où leur tenue est déjà réglée (`athletePaint`).
export const ATHLETE_AVATAR_SURFACE = {
  hurdles: "lane",
  poleVault: "piste",
  tripleJump: "lime",
  discus: "lane",
  longJump: "piste",
  highJump: "lime",
} as const satisfies Record<string, Surface & AvatarGround>;

// Les pelages : une teinte principale, une claire (museau, ventre), une sombre (oreilles, taches).
const fur = {
  fox: "#E8742C",
  cream: "#F7EAD7",
  white: color.white,
  grey: "#9C9EA6",
  greyLight: "#D5D6DB",
  brown: "#8A5A3B",
  brownDark: "#5E3B26",
  honey: "#D89A3E",
  sand: "#EFCB94",
  green: "#3E9B4F",
  greenLight: "#9FD86B",
  pink: color.brandOnInk,
  beak: "#F28C28",
} as const;

export type AnimalPaint = {
  ground: string;
  main: string;
  light: string;
  dark: string;
  // Les yeux et la truffe : l'encre, comme les yeux des athlètes.
  eye: string;
  // Un détail de couleur : l'intérieur des oreilles, un bec, des joues.
  accent: string;
};

const ink = color.ink;
const paint = (ground: AvatarGround, main: string, light: string, dark: string, accent: string): AnimalPaint => ({
  ground: AVATAR_GROUNDS[ground],
  main,
  light,
  dark,
  eye: ink,
  accent,
});

export const ANIMAL_PAINT = {
  fox: paint("lane", fur.fox, fur.cream, fur.brownDark, fur.cream),
  cat: paint("sun", fur.grey, fur.greyLight, ink, fur.pink),
  dog: paint("piste", fur.honey, fur.cream, fur.brownDark, fur.pink),
  bear: paint("sun", fur.brown, fur.sand, fur.brownDark, fur.sand),
  rabbit: paint("lane", fur.white, fur.white, fur.greyLight, fur.pink),
  owl: paint("piste", fur.honey, fur.white, fur.brownDark, fur.beak),
  panda: paint("lime", fur.white, fur.white, ink, fur.pink),
  lion: paint("lane", fur.sand, fur.white, fur.honey, fur.brownDark),
  frog: paint("sun", fur.green, fur.greenLight, fur.green, fur.white),
  penguin: paint("lane", ink, fur.white, ink, fur.beak),
  koala: paint("sun", fur.grey, fur.greyLight, ink, fur.white),
  hedgehog: paint("lime", fur.brown, fur.sand, fur.brownDark, fur.sand),
} as const satisfies Record<string, AnimalPaint>;
