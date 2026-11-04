import { m } from "@tartan/i18n";
import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { registerPush } from "../lib/notifications";
import { Button, ScreenTitle, T } from "../ui/primitives";
import { useSceneStatusBar } from "../ui/screen";
import { scene, space, usePagePad } from "../ui/theme";

export const Shell = ({ children }: { children: React.ReactNode }) => {
  useSceneStatusBar();
  const insets = useSafeAreaInsets();
  const pad = usePagePad();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: scene.page, paddingTop: insets.top }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: space.xl,
          paddingHorizontal: pad,
          paddingBottom: insets.bottom + space.xxl,
          gap: space.lg,
        }}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Après l'acceptation : pourquoi les notifications, puis arrivée sur Aujourd'hui.
export const PushStep = ({ coach, onDone }: { coach: boolean; onDone: () => void }) => {
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Shell>
      <ScreenTitle title={coach ? m.mobile.push.coachTitle : m.push.permissionTitle} />
      <T>{coach ? m.mobile.push.coachBody : m.push.permissionBody}</T>
      {denied ? (
        <T variant="small" accessibilityLiveRegion="polite">
          {m.mobile.push.denied}
        </T>
      ) : null}
      <Button
        testID="push-enable"
        label={m.push.enable}
        loading={busy}
        onPress={() => {
          setBusy(true);
          void registerPush({ prompt: true })
            .then((permission) => {
              if (permission === "granted") onDone();
              else setDenied(true);
            })
            .catch(() => setDenied(true))
            .finally(() => setBusy(false));
        }}
      />
      <Button testID="push-later" label={m.push.later} variant="secondary" onPress={onDone} />
    </Shell>
  );
};
