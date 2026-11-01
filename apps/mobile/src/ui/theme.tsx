import { tokens } from "@tartan/design-tokens";
import { createContext, useContext, type ReactNode } from "react";
import { useWindowDimensions, type TextStyle } from "react-native";

const c = tokens.color;
const s = tokens.scene;

// Quatre surfaces (DESIGN.md, « trois scènes ») :
// piste : le rouge plein écran, tout y est blanc ; card : dans une carte encre ou une feuille ;
// encre : mode séance, capture et vidéo ; hero : la seule carte craie, au plus une par écran.
export type SceneName = "piste" | "card" | "encre" | "hero";

export type Palette = {
  name: SceneName;
  dark: boolean;
  onRed: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
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
};

const inkBase = {
  dark: true,
  onRed: false,
  bg: s.card,
  surface: s.cardRaised,
  surfaceAlt: s.cardLine,
  text: s.text,
  textMuted: s.textMuted,
  border: s.cardLine,
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
} as const;

const palettes: Record<SceneName, Palette> = {
  piste: {
    ...inkBase,
    name: "piste",
    onRed: true,
    bg: s.page,
    surface: s.card,
    surfaceAlt: s.cardRaised,
    // Aucun texte atténué sur le rouge : seul le blanc y passe 4,5:1.
    text: s.onPage,
    textMuted: s.onPage,
    border: s.lane,
    controlLine: s.lane,
    accent: s.actionOnPage,
    accentText: s.onActionOnPage,
    link: s.onPage,
    focus: s.onPage,
    danger: s.onPage,
    ripple: c.ink3,
  },
  card: { ...inkBase, name: "card" },
  encre: { ...inkBase, name: "encre" },
  hero: {
    ...inkBase,
    name: "hero",
    dark: false,
    bg: s.hero,
    surface: c.surface,
    surfaceAlt: c.surfaceSunk,
    text: s.onHero,
    textMuted: c.muted,
    border: c.border,
    controlLine: c.muted,
    link: s.onHeroAccent,
    focus: s.onHero,
    danger: s.onHeroAccent,
    ripple: c.surfaceSunk,
    status: c.status,
    onStatus: c.white,
  },
};

const SceneContext = createContext<Palette>(palettes.piste);

// Rouge pour naviguer, encre pour le mode séance et la vidéo : le choix suit la scène.
export const Scene = ({
  scene,
  dark = false,
  children,
}: {
  scene?: SceneName;
  dark?: boolean;
  children: ReactNode;
}) => <SceneContext.Provider value={palettes[scene ?? (dark ? "encre" : "piste")]}>{children}</SceneContext.Provider>;

export const usePalette = (): Palette => useContext(SceneContext);

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;
export const radius = tokens.radius;
export const TOUCH = tokens.touch;
export const GUTTER = 16;
export const color = c;
export const scene = s;

const CONTENT_MAX = 720;

// Marge latérale de l'écran : sur tablette, le contenu reste centré sur une colonne lisible.
export const usePagePad = (): number => {
  const { width } = useWindowDimensions();
  return width > CONTENT_MAX + GUTTER * 2 ? (width - CONTENT_MAX) / 2 : GUTTER;
};

export type TextVariant =
  | "screen"
  | "display"
  | "title1"
  | "title2"
  | "figure"
  | "body"
  | "bodyStrong"
  | "small"
  | "smallStrong"
  | "caption"
  | "section"
  | "tab";

export const textStyles: Record<TextVariant, TextStyle> = {
  screen: { fontFamily: tokens.font.display, fontSize: 48, lineHeight: 50 },
  display: { fontFamily: tokens.font.display, fontSize: 34, lineHeight: 36 },
  title1: { fontFamily: tokens.font.display, fontSize: 28, lineHeight: 32 },
  title2: { fontFamily: tokens.font.title, fontSize: 22, lineHeight: 26 },
  figure: { fontFamily: tokens.font.title, fontSize: 20, lineHeight: 24, fontVariant: ["tabular-nums"] },
  body: { fontFamily: tokens.font.body, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: tokens.font.bodyStrong, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: tokens.font.body, fontSize: 15, lineHeight: 21 },
  smallStrong: { fontFamily: tokens.font.bodyStrong, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: tokens.font.bodyMedium, fontSize: 13, lineHeight: 16 },
  section: {
    fontFamily: tokens.font.bodyStrong,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  tab: { fontFamily: tokens.font.bodyStrong, fontSize: 11, lineHeight: 14 },
};
