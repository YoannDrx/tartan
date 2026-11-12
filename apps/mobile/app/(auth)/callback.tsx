import { m } from "@tartan/i18n";
import * as Linking from "expo-linking";
import { useNavigationContainerRef, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { switchAccount } from "../../src/lib/account-switch";
import { paramFromUrl } from "../../src/lib/auth-callback";
import { clearSessionCookie, storeSessionCookie } from "../../src/lib/auth-client";
import { clearPersistedData, queryClient } from "../../src/lib/query-client";
import { useSession } from "../../src/lib/session-store";
import { useSpaceStore } from "../../src/lib/space-store";
import { Button, T } from "../../src/ui/primitives";
import { LoadingState } from "../../src/ui/states";
import { GUTTER, scene, space } from "../../src/ui/theme";

// Le lien magique revient ici avec le cookie de session. Il ne reste ni dans l'historique ni dans les journaux.
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const cookie = paramFromUrl(url, "cookie");
  const error = paramFromUrl(url, "error");
  const refresh = useSession((s) => s.refresh);
  const router = useRouter();
  const navigation = useNavigationContainerRef();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) return;
    if (error || !cookie) {
      setFailed(true);
      return;
    }
    setFailed(false);
    // Un autre compte était peut-être ouvert sur ce téléphone : rien de lui ne doit rester à l'écran, ni dans la pile.
    switchAccount(cookie, {
      cancelQueries: () => queryClient.cancelQueries(),
      clearCookie: clearSessionCookie,
      storeCookie: storeSessionCookie,
      clearData: clearPersistedData,
      forgetActiveSpace: () => useSpaceStore.setState({ activeOrgId: null }),
      refreshSession: refresh,
      resetNavigation: () => navigation.reset({ index: 0, routes: [{ name: "index" }] }),
    }).catch(() => setFailed(true));
    // Une seule exécution par lien reçu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <View style={{ flex: 1, backgroundColor: scene.page, justifyContent: "center", padding: GUTTER, gap: space.lg }}>
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
