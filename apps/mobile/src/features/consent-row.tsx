import { m } from "@tartan/i18n";
import * as WebBrowser from "expo-web-browser";
import { Pressable, Switch, View } from "react-native";
import { config } from "../lib/config";
import { legalLinks } from "../lib/legal-links";
import { Button, T } from "../ui/primitives";
import { radius, scene, space, usePalette } from "../ui/theme";

// Un accord, ou une case, en une rangée entière : le libellé, une phrase qui dit ce qu'il change, l'interrupteur.
// Le lecteur d'écran lit la rangée comme un seul interrupteur, libellé et détail compris.
export const ConsentRow = ({
  label,
  detail,
  value,
  onChange,
  disabled,
  testID,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) => {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      style={{
        flexDirection: "row",
        gap: space.md,
        alignItems: "center",
        padding: space.md,
        backgroundColor: p.surface,
        borderRadius: radius.card,
        minHeight: 64,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T variant={detail ? "smallStrong" : "small"}>{label}</T>
        {detail ? (
          <T variant="caption" tone="muted">
            {detail}
          </T>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: scene.actionOnCard, false: scene.controlLine }}
        thumbColor={value ? scene.onActionOnCard : scene.text}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
};

// Les deux documents à lire avant d'accepter les conditions, ouverts dans le navigateur intégré.
export const LegalLinks = () => (
  <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
    <Button
      label={m.mobile.invite.termsLink}
      variant="ghost"
      compact
      style={{ paddingHorizontal: 0 }}
      onPress={() => void WebBrowser.openBrowserAsync(legalLinks(config.webUrl).terms)}
    />
    <Button
      label={m.mobile.invite.privacyLink}
      variant="ghost"
      compact
      style={{ paddingHorizontal: 0 }}
      onPress={() => void WebBrowser.openBrowserAsync(legalLinks(config.webUrl).privacy)}
    />
  </View>
);
