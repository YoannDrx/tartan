import { useQuery } from "@tanstack/react-query";
import { canRestart } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { usePathname, useRouter } from "expo-router";
import * as Updates from "expo-updates";
import { useEffect, useRef, useState } from "react";
import { AppState, Linking, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { appVersion, nativePlatform } from "../lib/app-version";
import { useMe } from "../lib/queries";
import { useSession } from "../lib/session-store";
import { useOpQueue } from "../lib/sync/op-queue";
import { useUploads } from "../lib/upload/upload-queue";
import { Button, T } from "../ui/primitives";
import { radius, space, usePalette } from "../ui/theme";

const CHECK_EVERY_MS = 30 * 60 * 1000;

// Le mode séance, la capture et la vidéo ne sont jamais interrompus par une proposition.
const isBusyRoute = (pathname: string) => /^\/(session|session-sets|coach-sets|capture|video|planner)/.test(pathname);

const useOtaReady = () => {
  const [ready, setReady] = useState(false);
  const lastCheck = useRef(0);
  useEffect(() => {
    if (!Updates.isEnabled) return;
    const check = async () => {
      if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = Date.now();
      try {
        const found = await Updates.checkForUpdateAsync();
        if (!found.isAvailable) return;
        const fetched = await Updates.fetchUpdateAsync();
        if (fetched.isNew) setReady(true);
      } catch {
        // Réseau de stade : la prochaine ouverture réessaie.
      }
    };
    void check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => sub.remove();
  }, []);
  return ready;
};

const Banner = ({ title, action, onPress }: { title: string; action: string; onPress: () => void }) => {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute",
        left: space.md,
        right: space.md,
        bottom: insets.bottom + 84,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
        borderRadius: radius.card,
        backgroundColor: p.surface,
        borderWidth: 1,
        borderColor: p.border,
      }}
    >
      <T variant="smallStrong" style={{ flex: 1 }}>
        {title}
      </T>
      <Button label={action} variant="secondary" compact onPress={onPress} />
    </View>
  );
};

const RequiredUpdate = ({ storeUrl }: { storeUrl: string }) => {
  const p = usePalette();
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: "center",
        justifyContent: "center",
        gap: space.lg,
        padding: space.xxl,
        backgroundColor: p.bg,
      }}
    >
      <T variant="title1" style={{ textAlign: "center" }}>
        {m.releases.required}
      </T>
      <T variant="body" style={{ textAlign: "center" }}>
        {m.releases.requiredDetail}
      </T>
      <Button label={m.releases.update} onPress={() => void Linking.openURL(storeUrl)} />
    </View>
  );
};

// Propose la mise à jour au bon moment ; ne recharge jamais l'app sans un geste de l'utilisateur.
export const UpdateGate = () => {
  const pathname = usePathname();
  const router = useRouter();
  const signedIn = useSession((s) => s.status === "signed-in");
  const me = useMe(signedIn);
  const syncing = useOpQueue((s) => s.syncing);
  const pending = useOpQueue((s) => s.items.length);
  const uploading = useUploads((s) => s.running);
  const otaReady = useOtaReady();
  const blockedOnce = useRef<boolean | null>(null);

  const status = useQuery({
    queryKey: ["release-status", nativePlatform, appVersion],
    queryFn: () => api.releaseStatus(nativePlatform, appVersion ?? "0.0.0"),
    enabled: Boolean(appVersion),
    staleTime: CHECK_EVERY_MS,
    networkMode: "online",
  });
  const unseen = useQuery({
    queryKey: ["releases", nativePlatform],
    queryFn: () => api.releases(nativePlatform),
    enabled: signedIn && Boolean(me.data),
    staleTime: CHECK_EVERY_MS,
    networkMode: "online",
  });

  // Le blocage se décide à froid et une seule fois, jamais hors ligne ni avec une file à vider.
  const required = status.data?.state === "required" && pending === 0;
  if (blockedOnce.current === null && status.data) blockedOnce.current = required;
  if (blockedOnce.current && status.data) return <RequiredUpdate storeUrl={status.data.storeUrl} />;

  if (isBusyRoute(pathname)) return null;

  if (
    otaReady &&
    canRestart({ uploading, capturing: false, inSession: false, syncing: syncing || pending > 0 })
  ) {
    return (
      <Banner
        title={m.releases.updateReady}
        action={m.releases.restart}
        onPress={() => void Updates.reloadAsync().catch(() => undefined)}
      />
    );
  }
  if (status.data?.state === "optional") {
    return (
      <Banner
        title={m.releases.newVersion}
        action={m.releases.update}
        onPress={() => void Linking.openURL(status.data?.storeUrl ?? "")}
      />
    );
  }
  if (unseen.data?.unseen && pathname !== "/nouveautes") {
    return (
      <Banner
        title={unseen.data.unseen.title}
        action={m.releases.seeAll}
        onPress={() => router.push("/nouveautes")}
      />
    );
  }
  return null;
};
