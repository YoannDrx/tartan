import { m } from "@tartan/i18n";
import { View } from "react-native";
import { Chip, SectionTitle, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { space } from "../../src/ui/theme";
import { themePreferences, useThemePreference } from "../../src/ui/theme-preference";

// Rubrique Apparence : le thème des écrans de travail, sur ce téléphone.
export default function AppearanceSettings() {
  const theme = useThemePreference((state) => state.preference);
  const setTheme = useThemePreference((state) => state.setPreference);
  return (
    <StackScreen title={m.account.settings.rubrics.apparence.title}>
      <View style={{ gap: space.sm }}>
        <SectionTitle>{m.appearance.title}</SectionTitle>
        <T variant="caption" tone="muted">
          {m.appearance.hint}
        </T>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {themePreferences.map((option) => (
            <Chip
              key={option}
              testID={`theme-${option}`}
              tall
              label={m.appearance[option]}
              active={theme === option}
              onPress={() => setTheme(option)}
            />
          ))}
        </View>
      </View>
    </StackScreen>
  );
}
