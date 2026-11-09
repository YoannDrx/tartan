import { usePathname } from "expo-router";
import { tokens } from "@tartan/design-tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palettes, radius, space, textStyles, themedWorld, useWorkTheme, type WorldName } from "./theme";

const BAR_HEIGHT = 64;

// Le fond natif d'un onglet prend la couleur de son monde : le changement de rubrique est franc, sans éclair.
export const useWorldScene = () => {
  const theme = useWorkTheme();
  return (world: WorldName) => ({
    sceneStyle: { backgroundColor: palettes[themedWorld(world, theme)].bg },
  });
};

// Navigation claire dans les écrans de travail ; l’accueil conserve son identité encre et citron.
export const useTabBarOptions = () => {
  const insets = useSafeAreaInsets();
  const theme = useWorkTheme();
  const band = tokens.band;
  const expressive = /(^|\/)today$/.test(usePathname());
  const bar = expressive
    ? {
        surface: tokens.scene.card,
        text: tokens.scene.textMuted,
        selection: tokens.scene.actionOnCard,
        selectedText: tokens.scene.onActionOnCard,
        border: tokens.scene.cardLine,
      }
    : {
        surface: band.background,
        text: band.text,
        selection: band.action,
        selectedText: band.onAction,
        border: band.lane,
      };
  return {
    headerShown: false,
    tabBarActiveTintColor: bar.selectedText,
    tabBarInactiveTintColor: bar.text,
    tabBarActiveBackgroundColor: bar.selection,
    tabBarLabelStyle: { ...textStyles.tab, fontFamily: tokens.font.bodyStrong },
    tabBarStyle: {
      backgroundColor: bar.surface,
      borderTopWidth: expressive ? 1 : 2,
      borderTopColor: bar.border,
      height: BAR_HEIGHT + insets.bottom,
      paddingTop: space.xs + 2,
      paddingHorizontal: space.xs,
      paddingBottom: insets.bottom,
    },
    tabBarItemStyle: { borderRadius: radius.card, marginHorizontal: 2, marginBottom: space.xs, overflow: "hidden" },
    tabBarAllowFontScaling: false,
    sceneStyle: { backgroundColor: palettes[themedWorld("work", theme)].bg },
  } as const;
};
