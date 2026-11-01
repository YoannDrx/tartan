import { m } from "@tartan/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { storeSessionCookie } from "../../src/lib/auth-client";
import { useSession } from "../../src/lib/session-store";
import { Button, T } from "../../src/ui/primitives";
import { LoadingState } from "../../src/ui/states";
import { color, GUTTER, space } from "../../src/ui/theme";

// Le lien magique revient ici avec le cookie de session. Il ne reste ni dans l'historique ni dans les journaux.
export default function AuthCallback() {
  const { cookie, error } = useLocalSearchParams<{ cookie?: string; error?: string }>();
  const refresh = useSession((s) => s.refresh);
  const status = useSession((s) => s.status);
  const router = useRouter();
  const [failed, setFailed] = useState(Boolean(error));

  useEffect(() => {
    if (error) return;
    void (async () => {
      // Le serveur encode les espaces en « + » ; les valeurs du cookie restent en %XX.
      if (cookie) await storeSessionCookie(cookie.replace(/\+/g, " "));
      await refresh();
      if (cookie || status === "signed-in") router.replace("/");
      else setFailed(true);
    })().catch(() => setFailed(true));
    // Une seule exécution par lien reçu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cookie, error]);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, justifyContent: "center", padding: GUTTER, gap: space.lg }}>
      {failed ? (
        <>
          <T>{m.mobile.auth.callbackFailed}</T>
          <Button label={m.mobile.auth.backToSignIn} onPress={() => router.replace("/sign-in")} />
        </>
      ) : (
        <LoadingState label={m.mobile.auth.callbackLoading} />
      )}
    </View>
  );
}
