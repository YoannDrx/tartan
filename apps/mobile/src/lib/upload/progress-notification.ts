import { m } from "@tartan/i18n";
import { Platform } from "react-native";
import { UploadService } from "../../../modules/tartan-upload-service";

const STEP = 5;
let lastShown = -STEP;

// Android seulement : le service au premier plan garde l'envoi en vie écran éteint et porte sa notification.
// iOS poursuit seul le PUT d'arrière-plan et n'affiche pas de progression.
export const startUploadService = (name: string): void => {
  if (Platform.OS !== "android") return;
  lastShown = -STEP;
  try {
    UploadService?.start(
      "envois",
      m.mobile.uploadNotice.channel,
      m.mobile.uploadNotice.channelDetail,
      m.mobile.uploadNotice.title,
      m.mobile.uploadNotice.progress(name, 0),
    );
  } catch {
    // Service refusé : l'envoi continue tant que le système garde l'app, et reprend à la prochaine ouverture.
  }
};

export const showUploadProgress = (name: string, pct: number): void => {
  if (Platform.OS !== "android" || pct - lastShown < STEP) return;
  lastShown = pct;
  try {
    UploadService?.update(m.mobile.uploadNotice.title, m.mobile.uploadNotice.progress(name, pct), pct);
  } catch {
    // La notification n'est qu'un repère : l'envoi n'en dépend pas.
  }
};

export const clearUploadProgress = (): void => {
  lastShown = -STEP;
};

export const stopUploadService = (): void => {
  if (Platform.OS !== "android") return;
  try {
    UploadService?.stop();
  } catch {
    // Déjà arrêté.
  }
};
