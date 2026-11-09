import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { sentryOptions } from "../src/lib/sentry-scrub";
import { Barlow_400Regular } from "@expo-google-fonts/barlow/400Regular";
import { Barlow_500Medium } from "@expo-google-fonts/barlow/500Medium";
import { Barlow_600SemiBold } from "@expo-google-fonts/barlow/600SemiBold";
import { BarlowCondensed_600SemiBold } from "@expo-google-fonts/barlow-condensed/600SemiBold";
import { BarlowCondensed_700Bold } from "@expo-google-fonts/barlow-condensed/700Bold";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { tokens } from "@tartan/design-tokens";
import { useFonts } from "expo-font";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { setStatusBarStyle } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { startNetworkWatcher } from "../src/lib/network";
import { purgeAbandonedPlannerRecordings } from "../src/lib/planner-recording-files";
import {
  listenToNotificationResponses,
  listenToPushToken,
  registerPush,
  reportClientVersion,
  setupNotificationChannels,
} from "../src/lib/notifications";
import { useMe } from "../src/lib/queries";
import { UpdateGate } from "../src/features/update-gate";
import { persister, queryClient, shouldPersistQuery, WEEK_MS } from "../src/lib/query-client";
import { useSession } from "../src/lib/session-store";
import { useOpQueue } from "../src/lib/sync/op-queue";
import { flushUploads } from "../src/lib/upload/upload-queue";
import { palettes, scene, themedWorld, useWorkTheme, type WorldName } from "../src/ui/theme";

const variant = (Constants.expoConfig?.extra as { appVariant?: string } | undefined)?.appVariant ?? "development";
Sentry.init(sentryOptions(process.env.EXPO_PUBLIC_SENTRY_DSN, variant));

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
// Fond natif rouge : aucun flash blanc au démarrage ni entre deux écrans.
void SystemUI.setBackgroundColorAsync(scene.page).catch(() => undefined);
// Avant le premier écran ; chaque écran règle ensuite la barre d'état selon son fond (useSceneStatusBar).
setStatusBarStyle("light");

// Une fois connecté : la file du compte se recharge et le jeton de notification se rafraîchit.
const SessionEffects = () => {
  const status = useSession((s) => s.status);
  const me = useMe(status === "signed-in");
  const hydrate = useOpQueue((s) => s.hydrate);
  const flush = useOpQueue((s) => s.flush);
  const userId = me.data?.id;
  useEffect(() => {
    if (!userId) return;
    void hydrate(userId).then(flush);
    void flushUploads();
    void registerPush({ prompt: false });
    void reportClientVersion();
    return listenToPushToken();
  }, [userId, hydrate, flush]);
  return null;
};

// Sans session, seuls la connexion et le lien d'invitation restent accessibles.
const AuthGuard = () => {
  const status = useSession((s) => s.status);
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const first = segments[0];
  // Le lien de parrainage garde son code avant d'envoyer vers la connexion.
  const open = first === "(auth)" || first === "i" || first === "r";
  useEffect(() => {
    if (status === "signed-out" && !open && pathname !== "/sign-in") router.replace("/sign-in");
  }, [status, open, pathname, router]);
  return null;
};

export default function RootLayout() {
  const theme = useWorkTheme();
  const worldContent = (world: WorldName) => ({
    contentStyle: { backgroundColor: palettes[themedWorld(world, theme)].bg },
  });
  const [fontsLoaded, fontError] = useFonts({
    [tokens.font.display]: BarlowCondensed_700Bold,
    [tokens.font.title]: BarlowCondensed_600SemiBold,
    [tokens.font.body]: Barlow_400Regular,
    [tokens.font.bodyMedium]: Barlow_500Medium,
    [tokens.font.bodyStrong]: Barlow_600SemiBold,
  });
  const status = useSession((s) => s.status);
  const refresh = useSession((s) => s.refresh);
  const router = useRouter();

  useEffect(() => {
    // Reprise après arrêt du processus : aucun fichier de dictée dans la file hors ligne.
    // Un échec sera présenté avant toute nouvelle capture, sans journaliser de chemin.
    try {
      purgeAbandonedPlannerRecordings();
    } catch {
      /* réessayé avant la prochaine dictée */
    }
    void refresh();
    void setupNotificationChannels().catch(() => undefined);
    const stopNetwork = startNetworkWatcher();
    const stopNotifications = listenToNotificationResponses((route) => router.navigate(route as never));
    return () => {
      stopNetwork();
      stopNotifications();
    };
  }, [refresh, router]);

  const ready = (fontsLoaded || Boolean(fontError)) && status !== "loading";
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: WEEK_MS,
        buster: "1",
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      <SafeAreaProvider>
        <SessionEffects />
        <AuthGuard />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palettes[themedWorld("work", theme)].bg },
            // La transition d'une rubrique à l'autre reste franche : 200 ms, sans en-tête animé.
            animation: "simple_push",
            animationDuration: 200,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={worldContent("piste")} />
          <Stack.Screen name="(athlete)" options={{ animation: "none" }} />
          <Stack.Screen name="(coach)" options={{ animation: "none" }} />
          <Stack.Screen name="i/[token]" options={{ gestureEnabled: false, ...worldContent("piste") }} />
          <Stack.Screen
            name="session/[id]"
            options={{ gestureEnabled: false, contentStyle: { backgroundColor: scene.card } }}
          />
          <Stack.Screen name="video/[id]" options={{ contentStyle: { backgroundColor: scene.card } }} />
          <Stack.Screen name="capture" options={{ contentStyle: { backgroundColor: scene.card } }} />
          <Stack.Screen name="session-builder/[id]" options={worldContent("work")} />
          <Stack.Screen name="coach-session/[id]" options={worldContent("work")} />
          <Stack.Screen name="settings" options={worldContent("work")} />
          <Stack.Screen name="invite" />
          <Stack.Screen name="athletes/index" options={worldContent("work")} />
          <Stack.Screen name="athletes/[id]" options={worldContent("work")} />
          <Stack.Screen name="exercise/[id]" options={worldContent("work")} />
        </Stack>
        <UpdateGate />
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}
