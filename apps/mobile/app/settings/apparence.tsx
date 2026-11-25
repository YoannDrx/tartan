import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveSpace } from "../../src/lib/queries";
import { api } from "../../src/lib/api";
import { encouragementLabels as labels, encouragementTones, m } from "@tartan/i18n";
import { View } from "react-native";
import { Chip, SectionTitle, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { space } from "../../src/ui/theme";
import { themePreferences, useThemePreference } from "../../src/ui/theme-preference";

// Rubrique Apparence : le thème des écrans de travail, sur ce téléphone.
export default function AppearanceSettings() {
  const { me } = useActiveSpace();
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: api.updatePreferences,
    onSuccess: (data) => client.setQueryData(["me"], data),
  });
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
      <SectionTitle>{labels.title}</SectionTitle>
      {(["homeTone", "sessionTone"] as const).map((key) => (
        <View key={key} style={{ gap: space.sm }}>
          <T>{key === "homeTone" ? labels.home : labels.session}</T>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={key === "homeTone" ? labels.home : labels.session}
            style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
          >
            {encouragementTones.map((tone) => (
              <Chip
                key={tone}
                tall
                label={labels[tone]}
                active={(me.data?.preferences?.[key] ?? "calm") === tone}
                onPress={() => {
                  if (!save.isPending) save.mutate({ [key]: tone });
                }}
              />
            ))}
          </View>
        </View>
      ))}
      {save.isError && <T tone="danger">{m.common.genericError}</T>}
    </StackScreen>
  );
}
