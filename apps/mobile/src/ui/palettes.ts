import { tokens } from "@tartan/design-tokens";

const c = tokens.color;
const s = tokens.scene;
const film = c.film;
const w = tokens.work;

// Un monde remplit l'écran d'une rubrique ; les trois autres scènes sont posées dessus ou le remplacent :
// card : dans une carte encre ou une feuille ; encre : mode séance, capture et vidéo ; hero : la seule carte craie.
export type WorldName = "piste" | "couloir" | "craie" | "soleil" | "nuit" | "work";
export type SceneName = WorldName | "workCard" | "nuitCard" | "card" | "encre" | "hero";

export type Palette = {
  name: SceneName;
  // Contenu clair sur fond sombre : décide aussi de la barre d'état.
  dark: boolean;
  work: boolean;
  // Fond plein de rubrique : le contenu se pose sur des cartes, dans la scène `cardScene`.
  world: boolean;
  // Boutons secondaires et pastilles au repos : contour plein, sans surface.
  outlined: boolean;
  cardScene: SceneName;
  bg: string;
  surface: string;
  surfaceAlt: string;
  raised: string;
  onRaised: string;
  text: string;
  textMuted: string;
  border: string;
  lane: string;
  controlLine: string;
  accent: string;
  accentText: string;
  link: string;
  focus: string;
  danger: string;
  scrim: string;
  ripple: string;
  status: { done: string; partial: string; missed: string; upcoming: string };
  onStatus: string;
  jumperHair: string;
};

const inkBase = {
  dark: true,
  work: false,
  world: false,
  outlined: false,
  cardScene: "card",
  bg: s.card,
  surface: s.cardRaised,
  surfaceAlt: s.cardLine,
  raised: s.cardRaised,
  onRaised: s.text,
  text: s.text,
  textMuted: s.textMuted,
  border: s.cardLine,
  lane: s.lane,
  controlLine: s.controlLine,
  accent: s.actionOnCard,
  accentText: s.onActionOnCard,
  link: s.link,
  focus: s.link,
  danger: s.status.missed,
  scrim: `${s.card}B3`,
  ripple: s.cardLine,
  status: s.status,
  onStatus: s.onStatus,
  jumperHair: s.hero,
} as const satisfies Omit<Palette, "name">;

// Sur un fond plein, tout le texte garde une seule couleur : aucune teinte atténuée n'y tiendrait 4,5:1.
const fullWorld = (bg: string, text: string) =>
  ({
    ...inkBase,
    world: true,
    outlined: true,
    bg,
    surface: s.card,
    surfaceAlt: s.cardRaised,
    raised: s.card,
    onRaised: s.text,
    text,
    textMuted: text,
    border: text,
    lane: text,
    controlLine: text,
    link: text,
    focus: text,
    danger: text,
    ripple: c.ink3,
    jumperHair: c.ink,
  }) as const;

// Le citron disparaît sur les fonds clairs : l'accent y passe à l'encre, le citron devient son texte.
const inkAccent = {
  dark: false,
  accent: c.ink,
  accentText: film.lime,
  // Les statuts restent lisibles hors d'une carte encre : fait, en encre et citron, jamais en citron sur clair.
  status: { done: c.ink, partial: c.warningStrong, missed: c.brandStrong, upcoming: c.muted },
  onStatus: film.lime,
} as const;

const workBase = {
  ...inkBase,
  work: true,
  dark: false,
  cardScene: "workCard",
  bg: w.page,
  surface: w.surface,
  surfaceAlt: w.raised,
  raised: w.raised,
  onRaised: w.text,
  text: w.text,
  textMuted: w.muted,
  border: w.border,
  lane: w.border,
  controlLine: w.controlLine,
  accent: w.action,
  accentText: w.onAction,
  link: w.link,
  focus: w.actionHover,
  danger: w.status.missed,
  ripple: w.raised,
  status: w.status,
  onStatus: w.onStatus,
  jumperHair: w.text,
} as const satisfies Omit<Palette, "name">;

export const palettes: Record<SceneName, Palette> = {
  work: { ...workBase, name: "work", world: true },
  workCard: { ...workBase, name: "workCard", bg: w.surface, surface: w.page },
  piste: { ...fullWorld(s.page, s.onPage), name: "piste", accent: s.actionOnPage, accentText: s.onActionOnPage },
  couloir: { ...fullWorld(film.electric, c.white), name: "couloir" },
  craie: { ...fullWorld(s.hero, s.onHero), ...inkAccent, name: "craie" },
  soleil: { ...fullWorld(film.sun, c.ink), ...inkAccent, name: "soleil" },
  nuit: {
    ...fullWorld(c.ink, c.white),
    name: "nuit",
    cardScene: "nuitCard",
    surface: c.ink2,
    surfaceAlt: c.ink3,
    raised: c.ink2,
    jumperHair: s.hero,
  },
  // Dans une carte du monde nuit, posée sur l'encre : chaque surface monte d'une marche.
  nuitCard: {
    ...inkBase,
    name: "nuitCard",
    bg: c.ink2,
    surface: c.ink3,
    surfaceAlt: s.controlLine,
    raised: c.ink3,
    border: s.controlLine,
  },
  card: { ...inkBase, name: "card" },
  encre: { ...inkBase, name: "encre" },
  hero: {
    ...inkBase,
    ...inkAccent,
    name: "hero",
    outlined: true,
    bg: s.hero,
    surface: c.surface,
    surfaceAlt: c.surfaceSunk,
    raised: c.surfaceSunk,
    onRaised: s.onHero,
    text: s.onHero,
    textMuted: c.muted,
    border: c.border,
    lane: s.onHero,
    controlLine: c.muted,
    link: s.onHeroAccent,
    focus: s.onHero,
    danger: s.onHeroAccent,
    ripple: c.surfaceSunk,
    jumperHair: c.ink,
  },
};
