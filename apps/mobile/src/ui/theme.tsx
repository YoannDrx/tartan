import { tokens } from "@tartan/design-tokens";
import { createContext, useContext, type ReactNode } from "react";
import type { TextStyle } from "react-native";

const c = tokens.color;

export type Palette = {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentText: string;
  link: string;
  scrim: string;
  ripple: string;
};

export const lightPalette: Palette = {
  dark: false,
  bg: c.bg,
  surface: c.surface,
  surfaceAlt: c.surfaceSunk,
  text: c.ink,
  textMuted: c.muted,
  border: c.border,
  accent: c.brand,
  accentText: c.white,
  link: c.brandStrong,
  scrim: `${c.ink}80`,
  ripple: c.surfaceSunk,
};

export const darkPalette: Palette = {
  dark: true,
  bg: c.ink,
  surface: c.ink2,
  surfaceAlt: c.ink3,
  text: c.white,
  textMuted: c.mutedOnInk,
  border: c.ink3,
  accent: c.brand,
  accentText: c.white,
  link: c.brandOnInk,
  scrim: `${c.ink}B3`,
  ripple: c.ink3,
};

const SceneContext = createContext<Palette>(lightPalette);

// Clair pour naviguer, sombre pour le mode séance et la vidéo : le choix suit la scène.
export const Scene = ({ dark = false, children }: { dark?: boolean; children: ReactNode }) => (
  <SceneContext.Provider value={dark ? darkPalette : lightPalette}>{children}</SceneContext.Provider>
);

export const usePalette = (): Palette => useContext(SceneContext);

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;
export const radius = tokens.radius;
export const TOUCH = tokens.touch;
export const GUTTER = 16;
export const color = c;

export type TextVariant =
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
