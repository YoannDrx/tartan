import { tokens } from "@tartan/design-tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palettes, radius, scene, space, textStyles, type WorldName } from "./theme";

const BAR_HEIGHT = 64;

// Le fond natif d'un onglet prend la couleur de son monde : le changement de rubrique est franc, sans éclair.
export const worldScene = (world: WorldName) => ({ sceneStyle: { backgroundColor: palettes[world].bg } });

// Barre d'onglets encre : pictogramme + libellé 11 px, actif encre sur une pastille citron, dans tous les mondes.
export const useTabBarOptions = () => {
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    tabBarActiveTintColor: scene.onActionOnCard,
    tabBarInactiveTintColor: scene.textMuted,
    tabBarActiveBackgroundColor: scene.actionOnCard,
    tabBarLabelStyle: { ...textStyles.tab, fontFamily: tokens.font.bodyStrong },
    tabBarStyle: {
      backgroundColor: scene.card,
      borderTopWidth: 0,
      height: BAR_HEIGHT + insets.bottom,
      paddingTop: space.xs + 2,
      paddingHorizontal: space.xs,
      paddingBottom: insets.bottom,
    },
    tabBarItemStyle: { borderRadius: radius.card, marginHorizontal: 2, marginBottom: space.xs, overflow: "hidden" },
    tabBarAllowFontScaling: false,
    sceneStyle: { backgroundColor: scene.page },
  } as const;
};
