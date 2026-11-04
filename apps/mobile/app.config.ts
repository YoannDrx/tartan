import type { ConfigContext, ExpoConfig } from "expo/config";
import { type AppVariant, parseVariant, resolveApiUrl, universalHostsFor } from "./src/lib/app-variant.ts";

// Lu par Node au moment de la configuration : pas de types Node dans cette app.
const { existsSync } = require("node:fs") as { existsSync: (path: string) => boolean };

const BRICK = "#C4442B";
const UNIVERSAL_HOSTS = ["tartan.coach", "app.tartan.coach"];
// Les mêmes chemins que apple-app-site-association, côté serveur.
const UNIVERSAL_PATHS = ["/i/", "/r/", "/seance/", "/mes-sauts"];

const variantNames: Record<AppVariant, string> = {
  development: "Tartan Dev",
  preview: "Tartan Preview",
  production: "Tartan – Coach athlé",
};

const flag = (value: string | undefined) => value === "true";

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = parseVariant(process.env.APP_VARIANT);
  const suffix = variant === "production" ? "" : variant === "preview" ? ".preview" : ".dev";
  // Le serveur Better Auth ne fait confiance qu'à tartan:// et tartan-dev:// : la préversion partage tartan://.
  const scheme = variant === "development" ? "tartan-dev" : "tartan";

  const apiUrl = resolveApiUrl(variant, process.env.EXPO_PUBLIC_API_URL);
  const universalHosts = universalHostsFor(variant, UNIVERSAL_HOSTS);

  // Identifiants publics du projet EAS et de l'équipe Apple : aucun secret ici.
  const projectId = process.env.EAS_PROJECT_ID?.trim() || "0067d5f6-b62a-455e-9680-d7624cfd4676";
  const appleTeamId = process.env.APPLE_TEAM_ID?.trim() || "G9WFV7HNV6";
  // Sur EAS, une variable de type fichier donne son chemin ; en local, le fichier à côté de cette configuration.
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON?.trim() || "./google-services.json";
  const appleSignIn = flag(process.env.EXPO_PUBLIC_OAUTH_APPLE_ENABLED);
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || undefined;

  return {
    ...config,
    name: variantNames[variant],
    slug: "tartan",
    version: "0.1.0",
    scheme,
    orientation: "portrait",
    icon: "./assets/brand/icon-ios.png",
    userInterfaceStyle: "dark",
    backgroundColor: BRICK,
    ios: {
      supportsTablet: true,
      bundleIdentifier: `coach.tartan.app${suffix}`,
      ...(appleTeamId ? { appleTeamId } : {}),
      // Liens universels : le serveur doit publier apple-app-site-association.
      associatedDomains: universalHosts.map((host) => `applinks:${host}`),
      ...(appleSignIn ? { usesAppleSignIn: true } : {}),
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "Tartan utilise la caméra pour filmer les entraînements de tes athlètes.",
        NSMicrophoneUsageDescription: "Tartan enregistre le son des vidéos quand tu filmes.",
      },
    },
    android: {
      package: `coach.tartan.app${suffix}`,
      // Notifications : absent tant que le projet Firebase n'existe pas, l'app se construit quand même.
      ...(existsSync(googleServicesFile) ? { googleServicesFile } : {}),
      adaptiveIcon: {
        foregroundImage: "./assets/brand/adaptive-foreground.png",
        backgroundImage: "./assets/brand/adaptive-background.png",
      },
      predictiveBackGestureEnabled: false,
      permissions: ["android.permission.CAMERA", "android.permission.RECORD_AUDIO"],
      // La galerie passe par le sélecteur système : aucun accès à tous les fichiers.
      blockedPermissions: [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO",
        "android.permission.SYSTEM_ALERT_WINDOW",
      ],
      // App Links : le serveur doit publier assetlinks.json.
      intentFilters: universalHosts.map((host) => ({
        action: "VIEW",
        autoVerify: true,
        category: ["BROWSABLE", "DEFAULT"],
        data: UNIVERSAL_PATHS.map((pathPrefix) => ({ scheme: "https", host, pathPrefix })),
      })),
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-web-browser",
      ...(appleSignIn ? ["expo-apple-authentication"] : []),
      ["expo-secure-store", { faceIDPermission: false }],
      [
        "expo-splash-screen",
        {
          backgroundColor: BRICK,
          image: "./assets/brand/splash.png",
          imageWidth: 240,
          resizeMode: "contain",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/brand/notification.png",
          color: BRICK,
          defaultChannel: "seances",
          enableBackgroundRemoteNotifications: false,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Tartan ouvre ta pellicule pour importer une vidéo que tu choisis.",
          cameraPermission: "Tartan utilise la caméra pour filmer les entraînements de tes athlètes.",
          microphonePermission: "Tartan enregistre le son des vidéos quand tu filmes.",
        },
      ],
      ["expo-video", { supportsBackgroundPlayback: false, supportsPictureInPicture: false }],
    ],
    extra: {
      appVariant: variant,
      apiUrl,
      webUrl: process.env.EXPO_PUBLIC_WEB_URL?.trim() || "https://tartan.coach",
      // Masqués tant que les comptes Apple et Google ne sont pas configurés côté serveur.
      appleSignIn,
      googleSignIn: flag(process.env.EXPO_PUBLIC_OAUTH_GOOGLE_ENABLED),
      googleWebClientId,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
