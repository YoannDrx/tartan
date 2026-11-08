import { tokens } from "@tartan/design-tokens";
import { createContext, useContext, type ReactNode } from "react";
import { useColorScheme, useWindowDimensions, type TextStyle } from "react-native";
import { palettes, type Palette, type SceneName } from "./palettes";
import { useThemePreference } from "./theme-preference";

const c = tokens.color;
const s = tokens.scene;

export { palettes, type Palette, type SceneName, type WorldName } from "./palettes";

const SceneContext = createContext<Palette>(palettes.piste);

export const useDarkTheme = (): boolean => {
  const preference = useThemePreference((state) => state.preference);
  const system = useColorScheme();
  return preference === "dark" || (preference === "system" && system === "dark");
};

// Le thème choisi ne change que les écrans de travail ; accueil, vidéo et mode séance gardent leur scène.
const themedScene = (scene: SceneName, dark: boolean): SceneName =>
  !dark ? scene : scene === "work" ? "workDark" : scene === "workCard" ? "workCardDark" : scene;

// Un monde par rubrique, l'encre pour le mode séance et la vidéo : le choix suit la scène.
export const Scene = ({
  scene,
  dark = false,
  children,
}: {
  scene?: SceneName;
  dark?: boolean;
  children: ReactNode;
}) => {
  const darkTheme = useDarkTheme();
  return (
    <SceneContext.Provider value={palettes[themedScene(scene ?? (dark ? "encre" : "piste"), darkTheme)]}>
      {children}
    </SceneContext.Provider>
  );
};

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
  // Même voix que les titres d'écran, une marche plus bas : jamais de capitales au-dessus d'une section.
  section: { fontFamily: tokens.font.title, fontSize: 20, lineHeight: 24 },
  tab: { fontFamily: tokens.font.bodyStrong, fontSize: 11, lineHeight: 14 },
};
