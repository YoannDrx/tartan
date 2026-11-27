import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { Pressable } from "react-native";
import { useMe } from "../lib/queries";
import { Avatar } from "./avatar";
import { Settings } from "./icons";
import { IconButton } from "./primitives";

// L'entrée des réglages, en haut de chaque onglet : l'avatar de la personne connectée, comme dans l'en-tête du web.
// Le bouton garde son nom (« Ouvrir les réglages ») ; l'avatar est décoratif.
export const SettingsButton = () => {
  const router = useRouter();
  const me = useMe();
  if (!me.data) {
    return (
      <IconButton
        testID="open-settings"
        icon={Settings}
        label={m.mobile.a11y.openSettings}
        tone="filled"
        onPress={() => router.push("/settings")}
      />
    );
  }
  const name = [me.data.firstName, me.data.lastName].filter(Boolean).join(" ") || me.data.email;
  return (
    <Pressable
      testID="open-settings"
      accessibilityRole="button"
      accessibilityLabel={m.mobile.a11y.openSettings}
      onPress={() => router.push("/settings")}
      style={({ pressed }) => ({
        width: 52,
        height: 52,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Avatar
        person={{
          name,
          firstName: me.data.firstName,
          lastName: me.data.lastName,
          avatarUrl: me.data.avatarUrl,
          avatarPreset: me.data.avatarPreset,
        }}
        size="header"
      />
    </Pressable>
  );
};
