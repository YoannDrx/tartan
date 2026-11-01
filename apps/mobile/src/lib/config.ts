import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const scheme = Constants.expoConfig?.scheme;

if (typeof extra.apiUrl !== "string" || typeof scheme !== "string") {
  throw new Error("Configuration Tartan incomplète : apiUrl ou scheme manquant.");
}

export const config = {
  apiUrl: extra.apiUrl.replace(/\/$/, ""),
  webUrl: typeof extra.webUrl === "string" ? extra.webUrl.replace(/\/$/, "") : "https://tartan.coach",
  scheme,
  appleSignIn: extra.appleSignIn === true,
  googleSignIn: extra.googleSignIn === true,
  googleWebClientId: typeof extra.googleWebClientId === "string" ? extra.googleWebClientId : undefined,
  appVersion: Constants.expoConfig?.version ?? "0.0.0",
  projectId:
    (extra.eas as { projectId?: string } | undefined)?.projectId ?? Constants.easConfig?.projectId ?? undefined,
};
