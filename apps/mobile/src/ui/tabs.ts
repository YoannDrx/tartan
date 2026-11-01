import { tokens } from "@tartan/design-tokens";
import { color, textStyles } from "./theme";

// Barre d'onglets : pictogramme + libellé 11 px, actif en Piste foncé.
export const tabBarOptions = {
  headerShown: false,
  tabBarActiveTintColor: color.brandStrong,
  tabBarInactiveTintColor: color.muted,
  tabBarLabelStyle: { ...textStyles.tab, fontFamily: tokens.font.bodyStrong },
  tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.border, borderTopWidth: 1 },
  tabBarAllowFontScaling: false,
  sceneStyle: { backgroundColor: color.bg },
} as const;
