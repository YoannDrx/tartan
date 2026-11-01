import { tokens } from "@tartan/design-tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, scene, space, textStyles } from "./theme";

const BAR_HEIGHT = 64;

// Barre d'onglets encre : pictogramme + libellé 11 px, actif blanc sur une pastille rouge piste.
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
