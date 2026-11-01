import { m } from "@tartan/i18n";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const IDENTIFIER = "tartan-upload-progress";
const STEP = 5;
let lastShown = -STEP;

// Android seulement : iOS gère seul les envois d'arrière-plan et n'affiche pas de progression.
// Sans service au premier plan, Android peut interrompre l'envoi : il reprend au retour dans l'app.
export const showUploadProgress = (name: string, pct: number): void => {
  if (Platform.OS !== "android" || pct - lastShown < STEP) return;
  lastShown = pct;
  void Notifications.scheduleNotificationAsync({
    identifier: IDENTIFIER,
    content: {
      title: m.mobile.uploadNotice.title,
      body: m.mobile.uploadNotice.progress(name, pct),
      sticky: true,
      autoDismiss: false,
      sound: false,
    },
    trigger: { channelId: "envois" },
  }).catch(() => undefined);
};

export const clearUploadProgress = (): void => {
  lastShown = -STEP;
  if (Platform.OS !== "android") return;
  void Notifications.dismissNotificationAsync(IDENTIFIER).catch(() => undefined);
};
