import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { randomUUID } from "expo-crypto";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

export const appVersion: string | null = Constants.expoConfig?.version ?? null;
export const nativePlatform: "ios" | "android" = Platform.OS === "ios" ? "ios" : "android";
export const updateId = (): string | null => Updates.updateId ?? null;

const KEY = "tartan.installation-id";
let cached: string | null = null;

// Identifiant technique de cette installation, sans lien avec le matériel.
export const installationId = async (): Promise<string> => {
  if (cached) return cached;
  const saved = await AsyncStorage.getItem(KEY).catch(() => null);
  cached = saved ?? randomUUID();
  if (!saved) await AsyncStorage.setItem(KEY, cached).catch(() => undefined);
  return cached;
};

export const clientVersionInfo = async () => ({
  ...(appVersion ? { appVersion } : {}),
  updateId: updateId(),
  installationId: await installationId(),
});
