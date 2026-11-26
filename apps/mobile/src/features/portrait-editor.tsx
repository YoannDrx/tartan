import { m } from "@tartan/i18n";
import { File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { useRef, useState } from "react";
import { Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { config } from "../lib/config";
import { uploadAvatarPhoto } from "../lib/avatar-upload";
import type { MeResponse } from "@tartan/contracts";
import { Button, T } from "../ui/primitives";
import { space } from "../ui/theme";

const url = new URL("/mobile/portrait", config.apiUrl).href;
export function PortraitEditor({
  source,
  onClose,
  onSaved,
}: {
  source: string;
  onClose: () => void;
  onSaved: (me: MeResponse) => void;
}) {
  const view = useRef<WebView>(null);
  const saving = useRef(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      visible
      animationType="none"
      onRequestClose={() => {
        if (!saving.current) onClose();
      }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: space.sm }}>
          <Button variant="ghost" label={m.common.close} disabled={busy} onPress={onClose} />
          {error && <T accessibilityRole="alert">{m.account.avatar.uploadFailed}</T>}
        </View>
        <WebView
          ref={view}
          source={{ uri: url }}
          originWhitelist={[new URL(url).origin]}
          onShouldStartLoadWithRequest={(req) => req.url === url || req.url === "about:blank"}
          allowFileAccess={false}
          onError={() => setError(true)}
          onHttpError={() => setError(true)}
          onMessage={async ({ nativeEvent }) => {
            if (nativeEvent.url !== url || saving.current) return;
            let temp: File | undefined;
            try {
              const msg = JSON.parse(nativeEvent.data);
              if (msg.kind === "error") {
                setError(true);
                return;
              }
              if (msg.kind === "ready") {
                view.current?.postMessage(source);
                return;
              }
              if (msg.kind === "cancel") {
                onClose();
                return;
              }
              if (msg.kind !== "save" || typeof msg.image !== "string" || msg.image.length > 4_000_000)
                throw new Error();
              const match = /^data:image\/(jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(msg.image);
              if (!match) throw new Error();
              saving.current = true;
              setBusy(true);
              setError(false);
              temp = new File(Paths.cache, `portrait-${randomUUID()}.${match[1] === "webp" ? "webp" : "jpg"}`);
              temp.write(match[2]!, { encoding: "base64" });
              onSaved(await uploadAvatarPhoto(temp.uri));
            } catch {
              setError(true);
              view.current?.postMessage("retry-save");
            } finally {
              saving.current = false;
              setBusy(false);
              if (temp?.exists) temp.delete();
            }
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
