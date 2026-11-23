import type { ReactNode } from "react";
import { Pressable, Switch, View } from "react-native";
import { MutedChevron, T } from "../ui/primitives";
import { scene, space } from "../ui/theme";

// Les rangées des réglages : toute la ligne est la cible, et un seul élément pour le lecteur d'écran.

export const ToggleRow = ({
  title,
  detail,
  value,
  disabled,
  testID,
  onChange,
}: {
  title: string;
  detail: string;
  value: boolean;
  disabled: boolean;
  testID: string;
  onChange: (v: boolean) => void;
}) => (
  <Pressable
    testID={testID}
    disabled={disabled}
    onPress={() => onChange(!value)}
    accessibilityRole="switch"
    accessibilityLabel={detail ? `${title}. ${detail}` : title}
    accessibilityState={{ checked: value, disabled }}
    style={({ pressed }) => ({
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.md,
      minHeight: 64,
      opacity: pressed ? 0.75 : 1,
    })}
  >
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="smallStrong">{title}</T>
      {detail ? (
        <T variant="caption" tone="muted">
          {detail}
        </T>
      ) : null}
    </View>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Switch
        value={value}
        disabled={disabled}
        trackColor={{ true: scene.actionOnCard, false: scene.controlLine }}
        thumbColor={value ? scene.onActionOnCard : scene.text}
      />
    </View>
  </Pressable>
);

// Une rangée qui mène ailleurs : une rubrique, une page, un document.
export const LinkRow = ({
  label,
  detail,
  onPress,
  testID,
  role = "link",
  leading,
}: {
  label: string;
  detail?: string;
  onPress: () => void;
  testID?: string;
  role?: "link" | "button";
  leading?: ReactNode;
}) => (
  <Pressable
    testID={testID}
    onPress={onPress}
    accessibilityRole={role}
    accessibilityLabel={detail ? `${label}. ${detail}` : label}
    style={({ pressed }) => ({
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.md,
      minHeight: detail ? 64 : 52,
      opacity: pressed ? 0.7 : 1,
    })}
  >
    {leading}
    <View style={{ flex: 1, gap: 2 }}>
      <T variant={detail ? "smallStrong" : "small"}>{label}</T>
      {detail ? (
        <T variant="caption" tone="muted">
          {detail}
        </T>
      ) : null}
    </View>
    <MutedChevron />
  </Pressable>
);
