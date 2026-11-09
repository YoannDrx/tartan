import { m } from "@tartan/i18n";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { View } from "react-native";
import { api } from "../lib/api";
import { Button, T } from "../ui/primitives";
import { StackScreen } from "../ui/screen";
import { space } from "../ui/theme";

// Règle Apple 5.1.2(i) : l'envoi à un tiers est annoncé et accepté avant la première demande.
export function PlannerConsentNative() {
  const t = m.aiPlanner;
  const client = useQueryClient();
  const accept = useMutation({
    mutationFn: () => api.updatePreferences({ aiConsent: true }),
    onSuccess: (next) => client.setQueryData(["me"], next),
  });
  return (
    <StackScreen title={t.title}>
      <View style={{ gap: space.md }}>
        <T variant="smallStrong">{t.consentTitle}</T>
        <T>{t.consentBody}</T>
        <T tone="muted">{t.consentHealth}</T>
        <Button
          testID="ai-consent-accept"
          label={t.consentAccept}
          disabled={accept.isPending}
          onPress={() => accept.mutate()}
        />
      </View>
    </StackScreen>
  );
}
