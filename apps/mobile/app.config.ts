import type { ConfigContext, ExpoConfig } from "expo/config";

type AppVariant = "development" | "preview" | "production";

const BRICK = "#C4442B";
const UNIVERSAL_HOSTS = ["tartan.coach", "app.tartan.coach"];

const variantNames: Record<AppVariant, string> = {
  development: "Tartan Dev",
  preview: "Tartan Preview",
  production: "Tartan – Coach athlé",
};

const getVariant = (): AppVariant => {
  const value = process.env.APP_VARIANT;
  if (value === "preview" || value === "production") return value;
  return "development";
};

const flag = (value: string | undefined) => value === "true";

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = getVariant();
  const suffix = variant === "production" ? "" : variant === "preview" ? ".preview" : ".dev";
  // Le serveur Better Auth ne fait confiance qu'à tartan:// et tartan-dev:// : la préversion partage tartan://.
  const scheme = variant === "development" ? "tartan-dev" : "tartan";

  const apiUrlValue = process.env.EXPO_PUBLIC_API_URL?.trim();
  const configuredApiUrl = apiUrlValue === "" ? undefined : apiUrlValue;
  if (variant !== "development" && !configuredApiUrl) {
    throw new Error(`EXPO_PUBLIC_API_URL est obligatoire pour la variante ${variant}.`);
  }
  const apiUrl = configuredApiUrl ?? "http://localhost:3000";
  if (variant !== "development" && !apiUrl.startsWith("https://")) {
    throw new Error(`EXPO_PUBLIC_API_URL doit être en HTTPS pour la variante ${variant}.`);
  }

  const projectId = process.env.EAS_PROJECT_ID?.trim();
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
      // Liens universels : le serveur doit publier apple-app-site-association.
      associatedDomains: UNIVERSAL_HOSTS.map((host) => `applinks:${host}`),
      ...(appleSignIn ? { usesAppleSignIn: true } : {}),
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "Tartan utilise la caméra pour filmer les sauts de tes athlètes.",
        NSMicrophoneUsageDescription: "Tartan enregistre le son des vidéos de saut quand tu filmes.",
      },
    },
    android: {
      package: `coach.tartan.app${suffix}`,
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
      intentFilters: UNIVERSAL_HOSTS.map((host) => ({
        action: "VIEW",
        autoVerify: true,
        category: ["BROWSABLE", "DEFAULT"],
        data: [{ scheme: "https", host, pathPrefix: "/i/" }],
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
          photosPermission: "Tartan ouvre ta pellicule pour importer une vidéo de saut que tu choisis.",
          cameraPermission: "Tartan utilise la caméra pour filmer les sauts de tes athlètes.",
          microphonePermission: "Tartan enregistre le son des vidéos de saut quand tu filmes.",
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
